import { useMemo, useState } from 'react';
import { usePage } from '@inertiajs/react';
import {
    Phone, MessageSquare, Copy, Check, ExternalLink, Search, Info, Settings
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
import DirectoryEmptyState from '@/Components/directory/DirectoryEmptyState';
import DirectoryFilterChips from '@/Components/directory/DirectoryFilterChips';
import DirectoryResultCount from '@/Components/directory/DirectoryResultCount';
import { DirectorySearch } from '@/Components/directory/DirectorySearch';
import DirectoryViewToggle from '@/Components/directory/DirectoryViewToggle';
import { useDirectory, type DirectoryFacet } from '@/Components/directory/useDirectory';

interface PhonebookProps {
    initialData: PhonebookEntry[];
    /** The server's active categories, in display order. */
    categories?: PhonebookCategory[];
}

/** `011-222 3334`, `+963 …` and `0912…` are the same number to a reader. */
const stripNumber = (value: string) => value.replace(/[\s\-()+]/g, '');

/** The chip key derived from a row's English category name. */
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
    // raw permissions array. The old role check hid the admin UI from a plain
    // account that had been granted phonebook.* explicitly.
    const canManage = useCanAny()('phonebook.edit', 'phonebook.create');

    // A shared search link carries `?q=`. It is read from the page URL, which
    // the server and the browser both have, so the list is filtered in the
    // server-rendered HTML and the first client render matches it.
    const initialQuery = new URLSearchParams(page.url.split('?')[1] ?? '').get('q') ?? '';
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [copiedId, setCopiedId] = useState<string | null>(null);

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

        const derived = new Map<string, string>(); // category key -> label
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
        setTimeout(() => setCopiedId(null), 2000);
    };

    // Clean number for tel: protocol
    const getTelUrl = (number: string) => {
        return `tel:${number.replace(/[\s\-\(\)]/g, '')}`;
    };

    // Clean number for WhatsApp wa.me link
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

    return (
        <MainLayout>
            

            <div 
                className="min-h-screen text-foreground transition-colors" 
                dir="rtl"
                style={{ fontFamily: "var(--site-font, inherit)" }}
            >
                
                {/* Hero Header (Styled like SyOfficial) */}
                <section className="bg-card py-10 shadow-sm border-b border-border">
                    <div className="container mx-auto px-4 text-center max-w-4xl">
                        {canManage && (
                            <div className="mb-6 flex justify-center">
                                <a
                                    href="/admin/phonebook"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg hover:bg-primary/90 transition-all transform hover:-translate-y-0.5"
                                >
                                    <Settings className="w-4 h-4" />
                                    <span>لوحة تحكم إدارة دليل الهاتف (Admin Panel)</span>
                                </a>
                            </div>
                        )}
                        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">دليل الهاتف والواتساب</h1>
                        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                            أرقام التواصل والشكاوى والطوارئ للجهات الرسمية والخدمية السورية.
                        </p>

                        <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto items-center">
                            <DirectorySearch
                                size="lg"
                                value={directory.query}
                                onChange={directory.setQuery}
                                placeholder="ابحث بالجهة، القسم، أو رقم الهاتف..."
                                ariaLabel="ابحث بالجهة، القسم، أو رقم الهاتف"
                            />
                        </div>

                        <DirectoryFilterChips
                            label="الفئة"
                            className="mt-6"
                            options={facets[0].options}
                            value={directory.filters.category ?? []}
                            onChange={(next) => directory.setFilters({ ...directory.filters, category: next })}
                        />
                    </div>
                </section>

                {/* Content Section */}
                <div className="container mx-auto px-4 py-8 max-w-7xl">
                    
                    {/* Visual Controls */}
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <DirectoryResultCount>
                            {directory.results.length > 0 ? (
                                `عرض ${directory.results.length} رقم تواصل رسمي`
                            ) : (
                                "لم يتم العثور على أرقام تطابق البحث"
                            )}
                        </DirectoryResultCount>

                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">طريقة العرض:</span>
                            <DirectoryViewToggle value={viewMode} onChange={setViewMode} />
                        </div>
                    </div>

                    {directory.results.length === 0 ? (
                        <DirectoryEmptyState
                            icon={Search}
                            title="لا توجد نتائج"
                            description="جرب تعديل كلمات البحث أو الفلاتر."
                        />
                    ) : viewMode === 'grid' ? (
                        
                        // Card Grid View (5 items per row on PC)
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {directory.results.map(item => (
                                <Card key={item.id} className="overflow-hidden hover:shadow-md transition-all border border-border bg-card flex flex-col justify-between">
                                    <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                                        <div>
                                            <h3 className="font-bold text-foreground text-sm leading-snug line-clamp-2 mb-1">
                                                {item.name_ar}
                                            </h3>
                                            {item.name_en && (
                                                <p className="text-[11px] text-muted-foreground font-normal truncate">
                                                    {item.name_en}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {/* Clickable Number display (copies on click) */}
                                            <button aria-label="انقر لنسخ الرقم"
                                                onClick={() => handleCopy(item.number, item.id)}
                                                className="w-full text-center py-2 bg-muted/50 hover:bg-muted/80 rounded-xl border border-border/60 font-mono text-base font-extrabold text-foreground tracking-wide transition-colors cursor-pointer group flex items-center justify-center gap-2"
                                                title="انقر لنسخ الرقم"
                                            >
                                                <span>{item.number}</span>
                                                {copiedId === item.id ? (
                                                    <Check className="h-4 w-4 text-emerald-500 animate-in zoom-in-50" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                )}
                                            </button>

                                            {/* Action Buttons Row */}
                                            <div className="flex items-center gap-2 pt-1">
                                                {/* Call */}
                                                <Button aria-label="اتصال هاتفي"
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                    className="flex-1 flex items-center justify-center gap-1.5 text-xs h-8 px-2"
                                                    title="اتصال هاتفي"
                                                >
                                                    <a href={getTelUrl(item.number)}>
                                                        <Phone className="h-3.5 w-3.5 text-primary" />
                                                        <span>اتصال</span>
                                                    </a>
                                                </Button>

                                                {/* WhatsApp (shown only if available) */}
                                                {item.is_whatsapp && (
                                                    <Button aria-label="مراسلة عبر واتساب"
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                        className="flex-1 flex items-center justify-center gap-1.5 text-xs h-8 px-2 border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-600"
                                                        title="مراسلة عبر واتساب"
                                                    >
                                                        <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                            <MessageSquare className="h-3.5 w-3.5 text-emerald-500" />
                                                            <span>واتساب</span>
                                                        </a>
                                                    </Button>
                                                )}
                                            </div>

                                            {/* Bottom Row: Category tag on one side, Source link on the opposite side */}
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
                                                        <span>المصدر</span>
                                                        <ExternalLink className="h-3 w-3" />
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
                        
                        // Table View (Styled like SyOfficial)
                        <div className="bg-card rounded-lg shadow border border-border overflow-hidden">
                            <Table>
                                <TableHeader className="bg-muted">
                                    <TableRow>
                                        <TableHead className="text-right font-bold text-foreground">الجهة / القسم</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">الرقم</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">النوع</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">المصدر</TableHead>
                                        <TableHead className="text-right font-bold text-foreground">الإجراءات</TableHead>
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
                                            <TableCell className="font-mono text-sm font-extrabold text-foreground">{item.number}</TableCell>
                                            <TableCell>
                                                {item.is_whatsapp ? (
                                                    <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-semibold">
                                                        اتصال + واتساب
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="font-normal text-[10px] bg-muted/80">
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
                                                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                                                    >
                                                        <span>عرض المصدر</span>
                                                        <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground font-normal">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    
                                                    {/* Copy */}
                                                    <Button aria-label="نسخ الرقم"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleCopy(item.number, item.id)}
                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                                        title="نسخ الرقم"
                                                    >
                                                        {copiedId === item.id ? (
                                                            <Check className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <Copy className="h-4 w-4" />
                                                        )}
                                                    </Button>

                                                    {/* Call */}
                                                    <Button aria-label="اتصال هاتفي"
                                                        variant="ghost"
                                                        size="icon"
                                                        asChild
                                                        className="h-8 w-8 text-primary hover:text-primary/80"
                                                        title="اتصال هاتفي"
                                                    >
                                                        <a href={getTelUrl(item.number)}>
                                                            <Phone className="h-4 w-4" />
                                                        </a>
                                                    </Button>

                                                    {/* WhatsApp */}
                                                    {item.is_whatsapp && (
                                                        <Button aria-label="مراسلة عبر واتساب"
                                                            variant="ghost"
                                                            size="icon"
                                                            asChild
                                                            className="h-8 w-8 text-emerald-500 hover:text-emerald-600"
                                                            title="مراسلة عبر واتساب"
                                                        >
                                                            <a href={getWhatsAppUrl(item.number)} target="_blank" rel="noopener noreferrer">
                                                                <MessageSquare className="h-4 w-4" />
                                                            </a>
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    {/* Combined and Simplified Notes */}
                    <Card className="border-border bg-muted/20 shadow-sm p-5 mt-8">
                        <div className="flex gap-3.5 items-start text-xs text-muted-foreground leading-relaxed">
                            <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                            <div>
                                <span className="font-bold text-foreground block mb-1">ملاحظات حول أرقام الدليل الخدمي:</span>
                                تم جمع وتدقيق هذا الدليل من القرارات والبيانات الرسمية الصادرة عن الوزارات ومجالس المحافظات السورية. يرجى الملاحظة أن بعض الأرقام مخصصة للتواصل عبر قنوات المراسلة الفورية (مثل واتساب)، بينما تعمل الأرقام المختصرة وخطوط الهاتف الأرضي للاستجابة السريعة على مستوى الشبكات المحلية.
                            </div>
                        </div>
                    </Card>

                </div>

            </div>
        </MainLayout>
    );
}
