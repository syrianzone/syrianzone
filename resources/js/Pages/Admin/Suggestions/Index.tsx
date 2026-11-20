import React, { useCallback, useMemo, useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Input } from '@/Components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/Components/ui/select';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ExternalLink,
    Inbox,
    Loader2,
    Pencil,
    RefreshCw,
    Search,
    Upload,
    X,
} from 'lucide-react';
import {
    GovAppsIcon,
    GovtCvsIcon,
    MishwarIcon,
    PhonebookIcon,
    PromisesIcon,
    SyOfficialIcon,
    TransitIcon,
} from '@/Components/Icons/ProjectIcons';
import { apiErrorMessage } from '@/Lib/api';
import { normalizeArabic } from '@/Lib/arabic';
import { confirmDialog } from '@/Lib/confirm';
import { notify } from '@/Lib/notify';
import { cn } from '@/Lib/utils';
import { api as placesApi } from '@/Domain/places/api';
import { CATEGORY_LABELS as PLACE_CATEGORY_LABELS } from '@/Domain/places/categories';
import { REPORT_REASON_LABELS as PLACE_REPORT_REASON_LABELS } from '@/Domain/places/reports';
import type { PlaceCategory, PlaceReportReason } from '@/Domain/places/types';
import { promisesApi } from '@/Domain/promises/api';
import { suggestionsApi } from '@/Domain/suggestions/api';
import type {
    IncomingItemType,
    IncomingSectionId,
    IncomingSuggestionItem,
    IncomingSuggestionsOverview,
    SuggestionModule,
} from '@/Domain/suggestions/types';
import { transitAdminApi } from '@/Domain/transit/api';

type SectionFilter = IncomingSectionId | 'all';
type CategoryFilter = 'all' | 'additions' | 'edits' | 'reports';
type SortOrder = 'newest' | 'oldest';

const SECTION_ICONS: Record<IncomingSectionId, React.ComponentType<{ className?: string }>> = {
    govtcvs: GovtCvsIcon,
    syofficial: SyOfficialIcon,
    govapps: GovAppsIcon,
    phonebook: PhonebookIcon,
    promises: PromisesIcon,
    places: MishwarIcon,
    transit: TransitIcon,
};

const ITEM_TYPE_META: Record<
    IncomingItemType,
    { label: string; category: Exclude<CategoryFilter, 'all'>; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
    directory_add: { label: 'إضافة جديدة', category: 'additions', variant: 'default' },
    directory_edit: { label: 'اقتراح تعديل', category: 'edits', variant: 'secondary' },
    promise_suggestion: { label: 'وعد مقترح', category: 'additions', variant: 'default' },
    promise_speaker: { label: 'شخص مقترح', category: 'additions', variant: 'outline' },
    promise_report_progress: { label: 'تحديث وعد', category: 'reports', variant: 'secondary' },
    promise_report_error: { label: 'بلاغ خطأ', category: 'reports', variant: 'destructive' },
    place_submission: { label: 'مكان جديد', category: 'additions', variant: 'default' },
    place_report: { label: 'بلاغ على مكان', category: 'reports', variant: 'destructive' },
    transit_new_route: { label: 'مسار جديد', category: 'additions', variant: 'default' },
    transit_route_edit: { label: 'تعديل مسار', category: 'edits', variant: 'secondary' },
};

const CATEGORY_OPTIONS: ReadonlyArray<{ value: CategoryFilter; label: string }> = [
    { value: 'all', label: 'كل الأنواع' },
    { value: 'additions', label: 'إضافات جديدة' },
    { value: 'edits', label: 'تعديلات' },
    { value: 'reports', label: 'بلاغات وتحديثات' },
];

const PAYLOAD_LABELS: Record<string, string> = {
    role_title_ar: 'المنصب',
    institution_name_ar: 'الجهة',
    decree_ref: 'المرسوم / القرار',
    category_id: 'التصنيف',
    name_en: 'الاسم بالإنكليزية',
    account_url: 'رابط الحساب',
    official_url: 'الموقع الرسمي',
    android_url: 'Google Play',
    apple_url: 'App Store',
    number: 'الرقم',
    is_whatsapp: 'واتساب',
    sources_count: 'المصادر',
    statement_date: 'تاريخ التصريح',
    origin: 'المصدر',
    promises_count: 'الوعود المرتبطة',
    place_category: 'الفئة',
    photos_count: 'الصور',
    report_reason: 'سبب البلاغ',
    city: 'المدينة',
    price: 'التعرفة',
    linked_route: 'الخط المرتبط',
};

const ORIGIN_LABELS: Record<string, string> = {
    editor: 'محرر',
    public: 'اقتراح زائر',
    visitor: 'اقتراح زائر',
};

function safeExternalUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function formatTimestamp(iso: string | null): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString('ar-SY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function formatPayloadValue(key: string, val: string | number | boolean): string {
    if (typeof val === 'boolean') return val ? 'نعم' : 'لا';
    const str = String(val);
    if (key === 'place_category' && str in PLACE_CATEGORY_LABELS) {
        return PLACE_CATEGORY_LABELS[str as PlaceCategory];
    }
    if (key === 'report_reason' && str in PLACE_REPORT_REASON_LABELS) {
        return PLACE_REPORT_REASON_LABELS[str as PlaceReportReason];
    }
    if (key === 'origin' && str in ORIGIN_LABELS) {
        return ORIGIN_LABELS[str];
    }
    return str;
}

interface Props {
    initialOverview: IncomingSuggestionsOverview;
}

export default function IncomingSuggestionsIndex({ initialOverview }: Props) {
    const [overview, setOverview] = useState<IncomingSuggestionsOverview>(initialOverview);
    const [sectionFilter, setSectionFilter] = useState<SectionFilter>('all');
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [query, setQuery] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [busyUid, setBusyUid] = useState<string | null>(null);
    const [notes, setNotes] = useState<Record<string, string>>({});

    const sectionLabelMap = useMemo(
        () => Object.fromEntries(overview.sections.map((s) => [s.id, s.label])) as Record<IncomingSectionId, string>,
        [overview.sections],
    );

    const reload = useCallback(async () => {
        setRefreshing(true);
        try {
            const next = await suggestionsApi.overview();
            setOverview(next);
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر تحديث قائمة الاقتراحات الواردة'));
        } finally {
            setRefreshing(false);
        }
    }, []);

    const filteredItems = useMemo(() => {
        const needle = normalizeArabic(query);
        const list = overview.items.filter((item) => {
            if (sectionFilter !== 'all' && item.section !== sectionFilter) return false;
            if (categoryFilter !== 'all' && ITEM_TYPE_META[item.item_type].category !== categoryFilter) {
                return false;
            }
            if (needle) {
                const haystack = normalizeArabic(
                    [
                        item.title,
                        item.subtitle ?? '',
                        item.details ?? '',
                        item.submitter_name,
                        sectionLabelMap[item.section] ?? '',
                        ...Object.values(item.payload ?? {}).map((v) => String(v ?? '')),
                    ].join(' '),
                );
                if (!haystack.includes(needle)) return false;
            }
            return true;
        });

        if (sortOrder === 'oldest') {
            return [...list].reverse();
        }
        return list;
    }, [overview.items, sectionFilter, categoryFilter, query, sortOrder, sectionLabelMap]);

    const runAction = async (uid: string, request: () => Promise<unknown>, successMessage: string) => {
        setBusyUid(uid);
        try {
            await request();
            notify.success(successMessage);
            await reload();
        } catch (err) {
            notify.error(apiErrorMessage(err, 'تعذّر تنفيذ الإجراء'));
        } finally {
            setBusyUid(null);
        }
    };

    const handleDirectoryDecision = (item: IncomingSuggestionItem, action: 'accept' | 'dismiss') => {
        const module = (item.action_meta.module as SuggestionModule | undefined) ?? (item.section as SuggestionModule);
        const note = notes[item.uid];
        void runAction(
            item.uid,
            () => suggestionsApi.review(module, Number(item.record_id), action, note),
            action === 'accept' ? 'تم اعتماد الاقتراح ووضع علامة تمت المعالجة.' : 'تم إهمال الاقتراح.',
        );
    };

    const handlePromiseDecision = async (item: IncomingSuggestionItem, action: 'publish' | 'reject') => {
        if (action === 'reject') {
            const ok = await confirmDialog({
                title: `رفض «${item.title}»؟`,
                description: 'سيُرفض هذا الوعد ولن يظهر في عداد الوعود العام.',
                destructive: true,
                confirmText: 'رفض',
            });
            if (!ok) return;
        }
        await runAction(
            item.uid,
            () => promisesApi.moderate(String(item.record_id), action),
            action === 'publish' ? 'تم نشر الوعد.' : 'تم رفض اقتراح الوعد.',
        );
    };

    const handleSpeakerDecision = async (item: IncomingSuggestionItem, action: 'approve' | 'reject') => {
        if (action === 'reject') {
            const ok = await confirmDialog({
                title: `رفض الشخص المقترح «${item.title}»؟`,
                destructive: true,
                confirmText: 'رفض',
            });
            if (!ok) return;
        }
        await runAction(
            item.uid,
            () => promisesApi.reviewSpeaker(String(item.record_id), action),
            action === 'approve' ? 'تم اعتماد الشخص.' : 'تم رفض الشخص.',
        );
    };

    const handlePromiseReportDecision = (item: IncomingSuggestionItem, action: 'accept' | 'dismiss') => {
        const isProgress = item.item_type === 'promise_report_progress';
        void runAction(
            item.uid,
            () => promisesApi.reviewReport(Number(item.record_id), action),
            action === 'dismiss'
                ? 'تم إهمال البلاغ.'
                : isProgress
                    ? 'تم قبول التحديث وإضافته إلى سجل الوعد.'
                    : 'تم إغلاق البلاغ.',
        );
    };

    const handlePlaceDecision = async (item: IncomingSuggestionItem, action: 'approve' | 'reject') => {
        if (action === 'reject') {
            const ok = await confirmDialog({
                title: `رفض المكان «${item.title}»؟`,
                description: 'لن يُنشر هذا المكان على خريطة مشوار.',
                destructive: true,
                confirmText: 'رفض',
            });
            if (!ok) return;
        }
        await runAction(
            item.uid,
            () =>
                action === 'approve'
                    ? placesApi.adminApprove(Number(item.record_id))
                    : placesApi.adminReject(Number(item.record_id), null),
            action === 'approve' ? 'تمت الموافقة على المكان ونشره.' : 'تم رفض المكان.',
        );
    };

    const handlePlaceReportDecision = async (item: IncomingSuggestionItem, action: 'dismiss' | 'unpublish') => {
        const published = item.action_meta.place_status === 'approved';
        if (action === 'unpublish' && published) {
            const ok = await confirmDialog({
                title: `إخفاء «${item.title}» من الخريطة؟`,
                description: 'سيُزال المكان من خريطة مشوار ويعود إلى قائمة المراجعة، وتُغلق كل البلاغات المفتوحة عليه.',
                destructive: true,
                confirmText: 'إخفاء المكان',
            });
            if (!ok) return;
        }
        await runAction(
            item.uid,
            () => placesApi.adminResolveReport(Number(item.record_id), action),
            action === 'dismiss'
                ? 'تم رفض البلاغ.'
                : published
                    ? 'تم إخفاء المكان وإغلاق البلاغ.'
                    : 'تم إغلاق البلاغ.',
        );
    };

    const handleTransitDraftDecision = async (item: IncomingSuggestionItem, action: 'approve' | 'reject') => {
        if (action === 'reject') {
            const ok = await confirmDialog({
                title: `رفض مسودة المسار «${item.title}»؟`,
                destructive: true,
                confirmText: 'رفض',
            });
            if (!ok) return;
        }
        await runAction(
            item.uid,
            () =>
                action === 'approve'
                    ? transitAdminApi.approveDraft(Number(item.record_id))
                    : transitAdminApi.rejectDraft(Number(item.record_id), null),
            action === 'approve' ? 'تمت الموافقة على المسار ونشره.' : 'تم رفض المسودة.',
        );
    };

    const hasActiveFilters = sectionFilter !== 'all' || categoryFilter !== 'all' || query.trim() !== '';

    const resetFilters = () => {
        setSectionFilter('all');
        setCategoryFilter('all');
        setQuery('');
    };

    return (
        <MainLayout>
            <Head title="الاقتراحات الواردة" />
            <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8" dir="rtl">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                            العودة إلى لوحة التحكم
                        </Link>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <span
                                className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                                aria-hidden="true"
                            >
                                <Inbox className="h-5 w-5" />
                            </span>
                            <h1 className="text-2xl font-extrabold text-foreground">
                                الاقتراحات الواردة
                            </h1>
                            <Badge
                                variant={overview.total_pending > 0 ? 'default' : 'secondary'}
                                className="tabular-nums"
                                dir="ltr"
                            >
                                {overview.total_pending}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            نظرة موحّدة على جميع الاقتراحات والإضافات والبلاغات ومسودات المسارات الواردة من مختلف أقسام المنصة بانتظار المراجعة.
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void reload()}
                        disabled={refreshing}
                        className="gap-1.5"
                    >
                        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
                        تحديث
                    </Button>
                </div>

                {/* Section overview cards */}
                <section aria-label="ملخص الأقسام" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {overview.sections.map((section) => {
                        const Icon = SECTION_ICONS[section.id];
                        const isSelected = sectionFilter === section.id;
                        const hasPending = section.pending_count > 0;

                        return (
                            <Card
                                key={section.id}
                                className={cn(
                                    'transition-colors',
                                    isSelected && 'border-primary ring-1 ring-primary',
                                )}
                            >
                                <CardContent className="flex h-full flex-col justify-between gap-3 p-4">
                                    <button
                                        type="button"
                                        aria-pressed={isSelected}
                                        onClick={() => setSectionFilter(isSelected ? 'all' : section.id)}
                                        className="flex w-full items-start justify-between gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                                    >
                                        <div className="flex min-w-0 items-center gap-2.5">
                                            <span
                                                className={cn(
                                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                                                    hasPending
                                                        ? 'bg-primary/10 text-primary'
                                                        : 'bg-muted text-muted-foreground',
                                                )}
                                                aria-hidden="true"
                                            >
                                                <Icon className="h-5 w-5" />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-foreground">
                                                    {section.label}
                                                </p>
                                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                                    {section.breakdown.length > 0
                                                        ? section.breakdown
                                                              .map((b) => `${b.count} ${b.label}`)
                                                              .join(' · ')
                                                        : 'لا توجد عناصر معلّقة'}
                                                </p>
                                            </div>
                                        </div>
                                        <Badge
                                            variant={hasPending ? 'default' : 'secondary'}
                                            className="shrink-0 tabular-nums"
                                            dir="ltr"
                                        >
                                            {section.pending_count}
                                        </Badge>
                                    </button>

                                    <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs">
                                        <span className="text-muted-foreground">
                                            {isSelected ? 'مُصفّى على هذا القسم' : 'اضغط للتصفية'}
                                        </span>
                                        <Link
                                            href={section.admin_url}
                                            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                        >
                                            إدارة القسم
                                            <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                                        </Link>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </section>

                {/* Filters & search bar */}
                <Card>
                    <CardContent className="space-y-3 p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                            <div className="relative flex-1">
                                <Search
                                    className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="ابحث بالعنوان، التفاصيل، الجهة، أو اسم المرسل..."
                                    aria-label="البحث في الاقتراحات الواردة"
                                    className="ps-9"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Select
                                    value={categoryFilter}
                                    onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}
                                >
                                    <SelectTrigger className="w-40" aria-label="تصفية حسب النوع">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORY_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={sortOrder}
                                    onValueChange={(v) => setSortOrder(v as SortOrder)}
                                >
                                    <SelectTrigger className="w-36" aria-label="ترتيب العناصر">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">الأحدث أولاً</SelectItem>
                                        <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                                    </SelectContent>
                                </Select>

                                {hasActiveFilters && (
                                    <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                                        مسح التصفية
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div
                            className="flex flex-wrap items-center gap-1.5"
                            role="group"
                            aria-label="تصفية حسب القسم"
                        >
                            <FilterChip
                                active={sectionFilter === 'all'}
                                onClick={() => setSectionFilter('all')}
                                className="gap-1.5 py-1"
                            >
                                <span>كل الأقسام</span>
                                <span dir="ltr" className="tabular-nums opacity-80">
                                    ({overview.total_pending})
                                </span>
                            </FilterChip>
                            {overview.sections.map((section) => (
                                <FilterChip
                                    key={section.id}
                                    active={sectionFilter === section.id}
                                    onClick={() =>
                                        setSectionFilter(sectionFilter === section.id ? 'all' : section.id)
                                    }
                                    className="gap-1.5 py-1"
                                >
                                    <span>{section.label}</span>
                                    <span dir="ltr" className="tabular-nums opacity-80">
                                        ({section.pending_count})
                                    </span>
                                </FilterChip>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Unified feed */}
                <section aria-label="قائمة الاقتراحات الواردة" className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                            عرض <strong className="font-semibold text-foreground" dir="ltr">{filteredItems.length}</strong>{' '}
                            من أصل <strong className="font-semibold text-foreground" dir="ltr">{overview.items.length}</strong> عنصر معلّق
                        </span>
                        {overview.generated_at && (
                            <span>آخر تحديث: {formatTimestamp(overview.generated_at)}</span>
                        )}
                    </div>

                    {overview.items.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
                                <CheckCircle2 className="h-10 w-10 text-primary/70" aria-hidden="true" />
                                <p className="text-base font-bold text-foreground">
                                    لا توجد اقتراحات بانتظار المراجعة حالياً
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    جميع أقسام المنصة محدّثة ولا يوجد أي اقتراح أو بلاغ أو مسودة معلّقة.
                                </p>
                            </CardContent>
                        </Card>
                    ) : filteredItems.length === 0 ? (
                        <Card>
                            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                                <Inbox className="h-9 w-9 text-muted-foreground/70" aria-hidden="true" />
                                <p className="font-semibold text-foreground">
                                    لا توجد نتائج مطابقة للتصفية الحالية
                                </p>
                                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                                    عرض كل الاقتراحات الواردة
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {filteredItems.map((item) => {
                                const SectionIcon = SECTION_ICONS[item.section];
                                const typeMeta = ITEM_TYPE_META[item.item_type];
                                const sourceHref = safeExternalUrl(item.source_url);
                                const isBusy = busyUid === item.uid;
                                const isDirectory =
                                    item.item_type === 'directory_add' || item.item_type === 'directory_edit';
                                const payloadEntries = Object.entries(item.payload ?? {}).filter(
                                    ([, val]) => val !== null && val !== undefined && val !== '',
                                );

                                return (
                                    <Card key={item.uid}>
                                        <CardContent className="space-y-3 p-4 sm:p-5">
                                            {/* Top metadata + link to dedicated admin */}
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <Badge variant="outline" className="gap-1">
                                                            <SectionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                                            {sectionLabelMap[item.section]}
                                                        </Badge>
                                                        <Badge variant={typeMeta.variant}>
                                                            {typeMeta.label}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            بواسطة{' '}
                                                            <strong className="font-medium text-foreground">
                                                                {item.submitter_name}
                                                            </strong>
                                                            {item.created_at && ` · ${formatTimestamp(item.created_at)}`}
                                                        </span>
                                                    </div>

                                                    <h2 className="text-base font-bold text-foreground">
                                                        {item.title}
                                                    </h2>

                                                    {item.subtitle && (
                                                        <p className="text-xs text-muted-foreground">
                                                            {item.subtitle}
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                                    {item.item_admin_url && (
                                                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                                                            <Link href={item.item_admin_url}>
                                                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                                                فتح للمراجعة
                                                            </Link>
                                                        </Button>
                                                    )}
                                                    {item.section_admin_url !== item.item_admin_url && (
                                                        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
                                                            <Link href={item.section_admin_url}>
                                                                لوحة القسم
                                                                <ArrowLeft className="h-3 w-3" aria-hidden="true" />
                                                            </Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Structured metadata chips */}
                                            {payloadEntries.length > 0 && (
                                                <div className="flex flex-wrap gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs">
                                                    {payloadEntries.map(([key, val]) => {
                                                        const label = PAYLOAD_LABELS[key] ?? key;
                                                        const formatted = formatPayloadValue(
                                                            key,
                                                            val as string | number | boolean,
                                                        );
                                                        const href =
                                                            typeof val === 'string' && key.endsWith('_url')
                                                                ? safeExternalUrl(val)
                                                                : null;
                                                        return (
                                                            <span
                                                                key={key}
                                                                className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1"
                                                            >
                                                                <span className="text-muted-foreground">
                                                                    {label}:
                                                                </span>
                                                                {href ? (
                                                                    <a
                                                                        href={href}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        dir="ltr"
                                                                        className="max-w-[220px] truncate font-medium text-primary hover:underline"
                                                                    >
                                                                        {formatted}
                                                                    </a>
                                                                ) : (
                                                                    <span
                                                                        dir={
                                                                            key === 'number' ||
                                                                            key === 'name_en' ||
                                                                            key === 'statement_date'
                                                                                ? 'ltr'
                                                                                : undefined
                                                                        }
                                                                        className="font-medium text-foreground"
                                                                    >
                                                                        {formatted}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            {/* Details body */}
                                            {item.details && (
                                                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                                                    {item.details}
                                                </p>
                                            )}

                                            {/* External source URL */}
                                            {sourceHref && (
                                                <div>
                                                    <a
                                                        href={sourceHref}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                                    >
                                                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                        <span dir="ltr" className="max-w-md truncate">
                                                            {sourceHref}
                                                        </span>
                                                    </a>
                                                </div>
                                            )}

                                            {/* Quick moderation actions */}
                                            <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                                                {isDirectory ? (
                                                    <>
                                                        <Input
                                                            value={notes[item.uid] ?? ''}
                                                            onChange={(e) =>
                                                                setNotes((prev) => ({
                                                                    ...prev,
                                                                    [item.uid]: e.target.value,
                                                                }))
                                                            }
                                                            placeholder="ملاحظة تحريرية داخلية (اختياري)..."
                                                            aria-label={`ملاحظة تحريرية لـ ${item.title}`}
                                                            className="h-9 flex-1 text-xs"
                                                            maxLength={1000}
                                                        />
                                                        <div className="flex items-center gap-2">
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                disabled={isBusy}
                                                                onClick={() => handleDirectoryDecision(item, 'accept')}
                                                                className="gap-1.5"
                                                            >
                                                                {isBusy ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                                ) : (
                                                                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                                )}
                                                                تمت المعالجة
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={isBusy}
                                                                onClick={() => handleDirectoryDecision(item, 'dismiss')}
                                                                className="gap-1.5"
                                                            >
                                                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                                إهمال
                                                            </Button>
                                                        </div>
                                                    </>
                                                ) : item.item_type === 'promise_suggestion' ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isBusy || Number(item.action_meta.sources_count ?? 0) === 0}
                                                            onClick={() => void handlePromiseDecision(item, 'publish')}
                                                            className="gap-1.5"
                                                            title={
                                                                Number(item.action_meta.sources_count ?? 0) === 0
                                                                    ? 'يحتاج مصدراً واحداً على الأقل قبل النشر'
                                                                    : undefined
                                                            }
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            نشر
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBusy}
                                                            onClick={() => void handlePromiseDecision(item, 'reject')}
                                                            className="gap-1.5 text-destructive hover:text-destructive"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                            رفض
                                                        </Button>
                                                    </div>
                                                ) : item.item_type === 'promise_speaker' ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isBusy}
                                                            onClick={() => void handleSpeakerDecision(item, 'approve')}
                                                            className="gap-1.5"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            اعتماد
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBusy}
                                                            onClick={() => void handleSpeakerDecision(item, 'reject')}
                                                            className="gap-1.5 text-destructive hover:text-destructive"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                            رفض
                                                        </Button>
                                                    </div>
                                                ) : item.item_type === 'promise_report_progress' ||
                                                  item.item_type === 'promise_report_error' ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isBusy}
                                                            onClick={() => handlePromiseReportDecision(item, 'accept')}
                                                            className="gap-1.5"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            {item.item_type === 'promise_report_progress'
                                                                ? 'قبول وإضافة للسجل'
                                                                : 'تمت المعالجة'}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBusy}
                                                            onClick={() => handlePromiseReportDecision(item, 'dismiss')}
                                                            className="gap-1.5"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                            إهمال
                                                        </Button>
                                                    </div>
                                                ) : item.item_type === 'place_submission' ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isBusy}
                                                            onClick={() => void handlePlaceDecision(item, 'approve')}
                                                            className="gap-1.5"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            قبول ونشر
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBusy}
                                                            onClick={() => void handlePlaceDecision(item, 'reject')}
                                                            className="gap-1.5 text-destructive hover:text-destructive"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                            رفض
                                                        </Button>
                                                    </div>
                                                ) : item.item_type === 'place_report' ? (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="destructive"
                                                            disabled={isBusy}
                                                            onClick={() =>
                                                                void handlePlaceReportDecision(item, 'unpublish')
                                                            }
                                                            className="gap-1.5"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            {item.action_meta.place_status === 'approved'
                                                                ? 'إخفاء المكان'
                                                                : 'إغلاق البلاغ'}
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBusy}
                                                            onClick={() =>
                                                                void handlePlaceReportDecision(item, 'dismiss')
                                                            }
                                                            className="gap-1.5"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                            رفض البلاغ
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isBusy}
                                                            onClick={() =>
                                                                void handleTransitDraftDecision(item, 'approve')
                                                            }
                                                            className="gap-1.5"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                                                            ) : (
                                                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                                            )}
                                                            موافقة ونشر
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            variant="outline"
                                                            disabled={isBusy}
                                                            onClick={() =>
                                                                void handleTransitDraftDecision(item, 'reject')
                                                            }
                                                            className="gap-1.5 text-destructive hover:text-destructive"
                                                        >
                                                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                                                            رفض
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </MainLayout>
    );
}
