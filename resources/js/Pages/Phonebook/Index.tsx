import { useEffect, useMemo, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Phone, MessageSquare, MessageSquarePlus, Copy, Check, ExternalLink, Search, Info, Settings, PencilLine
} from 'lucide-react';
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Badge } from "@/Components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/Components/ui/table";
import MainLayout from '@/Layouts/MainLayout';
import { useCanAny } from '@/Lib/useCan';
import { copyText } from '@/Lib/copy';
import { matchesFilterText } from '@/Lib/smartFilterSearch';
import type { PhonebookCategory, PhonebookEntry } from '@/Domain/phonebook/types';
import type { SuggestionCategoryOption, SuggestionTargetOption } from '@/Domain/suggestions/types';
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import { DirectoryFacetFilter } from '@/Components/directory/DirectoryFacetFilter';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import DirectorySuggestionDialog from '@/Domain/suggestions/DirectorySuggestionDialog';
import DirectoryViewToggle from '@/Components/directory/DirectoryViewToggle';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';
import { PageBody, PageHeader } from '@/Components/layout';

interface PhonebookProps {
    initialData: PhonebookEntry[];
    /** The server's active categories, in display order. */
    categories?: PhonebookCategory[];
}

/** `011-222 3334`, `+963 …` and `0912…` are the same number to a reader. */
const stripNumber = (value: string) => value.replace(/[\s\-()+]/g, '');

const categoryKey = (entry: PhonebookEntry) => (entry.category_en ?? '').toLowerCase().replace(/\s+/g, '_');

const isShortCode = (number: string) => {
    const clean = stripNumber(number);
    return clean.length === 3 && /^\d+$/.test(clean);
};

const searchPhonebook = (item: PhonebookEntry, query: string) => (
    matchesFilterText(
        [item.name_ar, item.name_en ?? '', item.category_ar ?? '', item.category_en ?? ''].join(' '),
        query,
    ) || (stripNumber(query) !== '' && stripNumber(item.number).includes(stripNumber(query)))
);

/** Short service numbers (110/113…) first, otherwise the server's order. */
const shortCodesFirst = (a: PhonebookEntry, b: PhonebookEntry) => {
    if (isShortCode(a.number) === isShortCode(b.number)) return 0;
    return isShortCode(a.number) ? -1 : 1;
};

export default function Index({ initialData, categories: serverCategories = [] }: PhonebookProps) {
    const page = usePage();
    // Server-resolved capabilities (role implications already applied), not the
    // raw permissions array.
    const canManage = useCanAny()('phonebook.edit', 'phonebook.create');

    // A shared search link carries `?q=`. It is read from the page URL, which
    // the server and the browser both have, so the list is filtered in the
    // server-rendered HTML and the first client render matches it.
    const initialQuery = new URLSearchParams(page.url.split('?')[1] ?? '').get('q') ?? '';
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const copiedTimerRef = useRef<number | null>(null);

    useEffect(() => () => {
        if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
    }, []);

    // The chips are the server's active categories in its own order, so a chip
    // and the admin row it edits name the same thing (`category_id`). Only a
    // page that arrives without them (an empty cache) derives them from the rows.
    const facets = useMemo<DirectoryFacet<PhonebookEntry>[]>(() => {
        if (serverCategories.length > 0) {
            return [{
                key: 'category',
                label: 'الفئة',
                options: serverCategories.map(cat => ({ value: cat.id, label: cat.label_ar })),
                valueOf: (entry) => entry.category_id,
            }];
        }

        const derived = new Map<string, string>();
        initialData.forEach(item => {
            if (item.category_en) {
                derived.set(categoryKey(item), item.category_ar ?? item.category_en);
            }
        });

        return [{
            key: 'category',
            label: 'الفئة',
            options: Array.from(derived.entries()).map(([value, label]) => ({ value, label })),
            valueOf: categoryKey,
        }];
    }, [serverCategories, initialData]);

    const directory = useDirectory<PhonebookEntry>({
        items: initialData,
        search: searchPhonebook,
        facets,
        sort: shortCodesFirst,
        initialQuery,
    });

    const handleCopy = async (number: string, id: string) => {
        if (!await copyText(number)) return;
        setCopiedId(id);
        // Restart the window on every copy so an older timer can't clear a newer tick.
        if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = window.setTimeout(() => setCopiedId(null), 2000);
    };

    const getTelUrl = (number: string) => {
        return `tel:${number.replace(/[\s\-\(\)]/g, '')}`;
    };

    const getWhatsAppUrl = (number: string) => {
        let cleaned = number.replace(/[\s\-\(\)]/g, '');
        if (cleaned.startsWith('00')) {
            cleaned = cleaned.substring(2);
        } else if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        if (cleaned.startsWith('09') && cleaned.length === 10) {
            cleaned = '963' + cleaned.substring(1);
        }
        return `https://wa.me/${cleaned}`;
    };

    const [suggestionOpen, setSuggestionOpen] = useState(false);
    const [suggestionTarget, setSuggestionTarget] = useState<SuggestionTargetOption | null>(null);

    const suggestionTargets = useMemo<SuggestionTargetOption[]>(
        () =>
            initialData.map((item) => ({
                id: item.id,
                label: item.name_ar,
                subtitle: item.number,
            })),
        [initialData],
    );

    const suggestionCategories = useMemo<SuggestionCategoryOption[]>(
        () => serverCategories.map((cat) => ({ id: cat.id, label: cat.label_ar })),
        [serverCategories],
    );

    const openAddSuggestion = () => {
        setSuggestionTarget(null);
        setSuggestionOpen(true);
    };

    const openEditSuggestion = (item: PhonebookEntry) => {
        setSuggestionTarget({
            id: item.id,
            label: item.name_ar,
            subtitle: item.number,
        });
        setSuggestionOpen(true);
    };

    return (
        <MainLayout>
            

            <div
                className="min-h-screen text-foreground transition-colors"
                dir="rtl"
                style={{ fontFamily: "var(--site-font, inherit)" }}
            >
                <PageHeader
                    title="دليل الهاتف والواتساب"
                    description="أرقام التواصل والشكاوى والطوارئ للجهات الرسمية والخدمية السورية."
                    actions={
                        <>
                            {canManage && (
                                <Button asChild variant="ghost" size="sm" className="h-9">
                                    <a href="/admin/phonebook">
                                        <Settings className="h-4 w-4" aria-hidden="true" />
                                        <span>إدارة الدليل</span>
                                    </a>
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 bg-card shadow-none"
                                onClick={openAddSuggestion}
                            >
                                <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                                <span>اقتراح تعديل</span>
                            </Button>
                        </>
                    }
                />

                <PageBody>
                    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                        <DirectorySearch
                            className="sm:max-w-xs"
                            value={directory.query}
                            onChange={directory.setQuery}
                            placeholder="ابحث بالجهة، القسم، أو الرقم..."
                            ariaLabel="ابحث بالجهة، القسم، أو رقم الهاتف"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-1">
                            <DirectoryFacetFilter
                                label="الفئة"
                                options={facets[0].options}
                                value={directory.filters.category ?? []}
                                onChange={(next) => directory.setFilters({ ...directory.filters, category: next })}
                            />
                            <div className="flex items-center gap-3 sm:ms-auto">
                                <DirectoryResultCount className="text-xs tabular-nums">
                                    {directory.results.length > 0
                                        ? `${directory.results.length} رقم`
                                        : 'لا توجد نتائج'}
                                </DirectoryResultCount>
                                <DirectoryViewToggle value={viewMode} onChange={setViewMode} />
                            </div>
                        </div>
                    </div>

                    {directory.results.length === 0 ? (
                        <DirectoryEmptyState
                            icon={Search}
                            title="لا توجد نتائج"
                            description="جرب تعديل كلمات البحث أو الفلاتر."
                            directory={directory}
                        />
                    ) : viewMode === 'grid' ? (
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {directory.results.map(item => (
                                <Card key={item.id} className="overflow-hidden hover:shadow-md transition-all border border-border bg-card flex flex-col justify-between">
                                    <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-1">
                                                    {item.name_ar}
                                                </h3>
                                                {item.name_en && (
                                                    <p className="text-[11px] text-muted-foreground font-normal truncate">
                                                        {item.name_en}
                                                    </p>
                                                )}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditSuggestion(item)}
                                                aria-label={`اقتراح تعديل — ${item.name_ar}`}
                                                title="اقتراح تعديل"
                                                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                                            >
                                                <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
                                            </Button>
                                        </div>

                                        <div className="space-y-2">
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(item.number, item.id)}
                                                className="w-full text-center py-2 bg-muted/50 hover:bg-muted/80 rounded-xl border border-border/60 font-mono text-base font-extrabold text-foreground tracking-wide transition-colors cursor-pointer group flex items-center justify-center gap-2"
                                                title="انقر لنسخ الرقم"
                                            >
                                                <bdi dir="ltr">{item.number}</bdi>
                                                <span className="sr-only">— نسخ رقم {item.name_ar}</span>
                                                {copiedId === item.id ? (
                                                    <Check className="h-4 w-4 text-emerald-500 animate-in zoom-in-50" aria-hidden="true" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
                                                )}
                                            </button>

                                            <div className="flex items-center gap-2 pt-1">
                                                <Button aria-label={`اتصال هاتفي بـ ${item.name_ar}`}
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs h-8 px-2"
                                                    title="اتصال هاتفي"
                                                >
                                                    <a href={getTelUrl(item.number)}>
                                                        <Phone className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                                        <span>اتصال</span>
                                                    </a>
                                                </Button>

                                                {item.is_whatsapp && (
                                                    <Button aria-label={`مراسلة ${item.name_ar} عبر واتساب (تفتح في نافذة جديدة)`}
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs h-8 px-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600"
                                                        title="مراسلة عبر واتساب"
                                                    >
                                                        <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                            <MessageSquare className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                                                            <span>واتساب</span>
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="pt-1 flex items-center justify-between text-[11px]">
                                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] font-semibold py-0.5 px-2 shrink-0">
                                                    {item.category_ar}
                                                </Badge>

                                                {item.source_url && item.source_url.trim() ? (
                                                    <a
                                                        href={item.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 font-normal"
                                                    >
                                                        <span>المصدر<span className="sr-only">: {item.name_ar} (يفتح في نافذة جديدة)</span></span>
                                                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                    </a>
                                                ) : (
                                                    <span className="text-muted-foreground/40 text-[10px]">بدون مصدر</span>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        
                        <div className="bg-card rounded-lg border border-border overflow-hidden">
                            {/* Mobile 2-row-per-item list */}
                            <ul className="md:hidden divide-y divide-border" aria-label="قائمة أرقام الهاتف">
                                {directory.results.map(item => (
                                    <li key={item.id} className="px-3.5 py-3 space-y-2">
                                        {/* Row 1: Entity + category | Phone number */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <span className="block text-sm font-bold text-foreground leading-snug">
                                                    {item.name_ar}
                                                </span>
                                                <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                                                    {item.category_ar}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(item.number, item.id)}
                                                className="shrink-0 inline-flex items-center gap-1.5 rounded-md bg-muted/60 hover:bg-muted px-2 py-1 font-mono text-sm font-extrabold tabular-nums text-foreground transition-colors"
                                                aria-label={`نسخ رقم ${item.name_ar} ${item.number}`}
                                                title="نسخ الرقم"
                                            >
                                                <bdi dir="ltr">{item.number}</bdi>
                                                {copiedId === item.id ? (
                                                    <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                                                ) : (
                                                    <Copy className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                                                )}
                                            </button>
                                        </div>

                                        {/* Row 2: Type badge + source | Actions */}
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {item.is_whatsapp ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold whitespace-nowrap">
                                                        اتصال + واتساب
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="font-normal text-[10px] bg-muted/80 whitespace-nowrap">
                                                        اتصال فقط
                                                    </Badge>
                                                )}
                                                {item.source_url && item.source_url.trim() && (
                                                    <a
                                                        href={item.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold whitespace-nowrap"
                                                    >
                                                        <span>المصدر<span className="sr-only">: {item.name_ar} (يفتح في نافذة جديدة)</span></span>
                                                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                    </a>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <Button
                                                    aria-label={`اتصال هاتفي بـ ${item.name_ar}`}
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                    className="h-8 w-8 text-primary hover:text-primary/80"
                                                    title="اتصال هاتفي"
                                                >
                                                    <a href={getTelUrl(item.number)}>
                                                        <Phone className="h-4 w-4" aria-hidden="true" />
                                                    </a>
                                                </Button>

                                                {item.is_whatsapp && (
                                                    <Button
                                                        aria-label={`مراسلة ${item.name_ar} عبر واتساب (تفتح في نافذة جديدة)`}
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                        className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                                                        title="مراسلة عبر واتساب"
                                                    >
                                                        <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                            <MessageSquare className="h-4 w-4" aria-hidden="true" />
                                                        </a>
                                                    </Button>
                                                )}

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditSuggestion(item)}
                                                    aria-label={`اقتراح تعديل — ${item.name_ar}`}
                                                    title="اقتراح تعديل"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                >
                                                    <PencilLine className="h-4 w-4" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            {/* Desktop table */}
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader className="bg-muted">
                                        <TableRow>
                                            <TableHead className="text-start font-bold text-foreground">الجهة / القسم</TableHead>
                                            <TableHead className="text-start font-bold text-foreground">الرقم</TableHead>
                                            <TableHead className="text-start font-bold text-foreground">النوع</TableHead>
                                            <TableHead className="text-start font-bold text-foreground">المصدر</TableHead>
                                            <TableHead className="text-start font-bold text-foreground">الإجراءات</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {directory.results.map(item => (
                                            <TableRow key={item.id} className="hover:bg-muted/50">
                                                <TableCell className="font-medium">
                                                    <div>
                                                        <span className="text-foreground font-bold text-sm block">{item.name_ar}</span>
                                                        <span className="text-[10px] text-muted-foreground font-normal">{item.category_ar}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-sm font-extrabold tabular-nums text-foreground"><bdi dir="ltr">{item.number}</bdi></TableCell>
                                                <TableCell>
                                                    {item.is_whatsapp ? (
                                                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold whitespace-nowrap">
                                                            اتصال + واتساب
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="font-normal text-[10px] bg-muted/80 whitespace-nowrap">
                                                            اتصال فقط
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {item.source_url && item.source_url.trim() ? (
                                                        <a
                                                            href={item.source_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold whitespace-nowrap"
                                                        >
                                                            <span>عرض المصدر<span className="sr-only">: {item.name_ar} (يفتح في نافذة جديدة)</span></span>
                                                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground font-normal">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Button aria-label={`نسخ رقم ${item.name_ar} ${item.number}`}
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleCopy(item.number, item.id)}
                                                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                            title="نسخ الرقم"
                                                        >
                                                            {copiedId === item.id ? (
                                                                <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                                                            ) : (
                                                                <Copy className="h-4 w-4" aria-hidden="true" />
                                                            )}
                                                        </Button>

                                                        <Button aria-label={`اتصال هاتفي بـ ${item.name_ar}`}
                                                            variant="ghost"
                                                            size="icon"
                                                            asChild
                                                            className="h-8 w-8 text-primary hover:text-primary/80"
                                                            title="اتصال هاتفي"
                                                        >
                                                            <a href={getTelUrl(item.number)}>
                                                                <Phone className="h-4 w-4" aria-hidden="true" />
                                                            </a>
                                                        </Button>

                                                        {item.is_whatsapp && (
                                                            <Button aria-label={`مراسلة ${item.name_ar} عبر واتساب (تفتح في نافذة جديدة)`}
                                                                variant="ghost"
                                                                size="icon"
                                                                asChild
                                                                className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                                                                title="مراسلة عبر واتساب"
                                                            >
                                                                <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                                                                </a>
                                                            </Button>
                                                        )}

                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => openEditSuggestion(item)}
                                                            aria-label={`اقتراح تعديل — ${item.name_ar}`}
                                                            title="اقتراح تعديل"
                                                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                        >
                                                            <PencilLine className="h-4 w-4" aria-hidden="true" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    <Card className="border-border bg-muted/20 shadow-xs p-5 mt-8">
                        <div className="flex gap-3.5 items-start text-xs text-muted-foreground leading-relaxed">
                            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold text-foreground block mb-1">ملاحظات حول أرقام الدليل الخدمي:</span>
                                تم جمع وتدقيق هذا الدليل من القرارات والبيانات الرسمية الصادرة عن الوزارات ومجالس المحافظات السورية. يرجى الملاحظة أن بعض الأرقام مخصصة للتواصل عبر قنوات المراسلة الفورية (مثل واتساب)، بينما تعمل الأرقام المختصرة وخطوط الهاتف الأرضي للاستجابة السريعة على مستوى الشبكات المحلية.
                            </div>
                        </div>
                    </Card>

                </PageBody>

            </div>

            <DirectorySuggestionDialog
                module="phonebook"
                open={suggestionOpen}
                onOpenChange={setSuggestionOpen}
                defaultKind={suggestionTarget ? 'edit' : 'add'}
                fixedTarget={suggestionTarget}
                targets={suggestionTargets}
                categories={suggestionCategories}
            />
        </MainLayout>
    );
}
