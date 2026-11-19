import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, router, usePage, useRemember } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import SmartFilterSearch from '@/Components/SmartFilterSearch';
import DirectorySuggestionDialog from '@/Domain/suggestions/DirectorySuggestionDialog';
import {
    ArrowLeftRight,
    ExternalLink,
    IdCard,
    LayoutGrid,
    List,
    MessageSquarePlus,
    SearchX,
    Settings,
} from 'lucide-react';
import { toggleFilterValue, type SmartFilterValue } from '@/Lib/smartFilterSearch';
import { useCanModule } from '@/Lib/useCan';
import { cn } from '@/Lib/utils';
import OfficialCard, { type OfficialCardLayout } from '@/Domain/govtcvs/OfficialCard';
import type {
    GovtCvsStats,
    GovtOfficialSummary,
    InstitutionOption,
} from '@/Domain/govtcvs/types';
import Scoreboard from './_components/Scoreboard';
import {
    activeScoreboardTile,
    filterOfficials,
    govtFilterFacets,
    govtListUrl,
    matchesStatus,
    readGovtFilters,
    selectScoreboardTile,
    SORT_OPTIONS,
    visibleOfficials,
    type GovtScoreboardTile,
} from './_lib/filters';

const LAYOUT_KEY = 'govtcvs-layout';
const LAYOUT_OPTIONS = [
    { value: 'grid', label: 'عرض كبطاقات', icon: LayoutGrid },
    { value: 'list', label: 'عرض كقائمة', icon: List },
] as const;

interface Props {
    officials: GovtOfficialSummary[];
    stats: GovtCvsStats;
    institutions: InstitutionOption[];
    filters?: {
        q?: string | null;
        status?: string | null;
        tier?: string | null;
        institution?: string | null;
        institution_id?: string | null;
        phase?: string | null;
        cv_completeness?: string | null;
        sort?: string | null;
    };
}

export default function GovtCvsIndex({
    officials = [],
    stats,
    institutions = [],
    filters = {},
}: Props) {
    const page = usePage();
    const canModule = useCanModule();
    const canAdmin = (canModule as (m: string) => boolean)('govtcvs');

    const facets = useMemo(() => govtFilterFacets(institutions), [institutions]);
    const initialValue = useMemo(
        () => readGovtFilters(page.url, facets, filters),
        [page.url, facets, filters],
    );
    const [value, setValue] = useRemember<SmartFilterValue>(initialValue, 'govtcvs.filters');
    const base = useMemo(() => filterOfficials(officials, value), [officials, value]);
    const visible = useMemo(() => visibleOfficials(base, value), [base, value]);
    const statusFacet = useMemo(() => facets.find((facet) => facet.key === 'status'), [facets]);
    const searchFacets = useMemo(() => facets.filter((facet) => facet.key !== 'status'), [facets]);

    const statusOptions = useMemo(() => {
        const raw =
            statusFacet?.options.map((option) => ({
                ...option,
                count: base.filter((o) => matchesStatus(o, option.value)).length,
            })) ?? [];
        const selected = value.filters.status ?? [];
        return raw.filter(
            (opt) =>
                (opt.value !== 'uncertain' && opt.value !== 'deceased') ||
                opt.count > 0 ||
                selected.includes(opt.value),
        );
    }, [statusFacet, base, value.filters.status]);

    const { status: selectedStatuses = [], ...searchFilters } = value.filters;
    const searchValue = { ...value, filters: searchFilters };
    const filtersRef = useRef<HTMLDivElement>(null);
    const [layout, setLayout] = useState<OfficialCardLayout>('grid');
    const [suggestOpen, setSuggestOpen] = useState(false);

    const suggestionTargets = useMemo(
        () =>
            officials.map((o) => ({
                id: o.id,
                label: o.display_name_ar || o.full_name_ar,
                subtitle: (o.current_tenure ?? o.latest_tenure)?.role_title_ar ?? null,
            })),
        [officials],
    );

    const resolvedStats: GovtCvsStats = useMemo(
        () => ({
            total: stats?.total ?? officials.length,
            in_office:
                stats?.in_office ?? officials.filter((o) => o.office_status === 'in_office').length,
            out_of_office:
                stats?.out_of_office ??
                officials.filter(
                    (o) => o.office_status === 'out_of_office' || o.office_status === 'deceased',
                ).length,
            uncertain:
                stats?.uncertain ?? officials.filter((o) => o.office_status === 'uncertain').length,
            full_cv:
                stats?.full_cv ?? officials.filter((o) => o.cv_completeness === 'full_cv').length,
            total_movements: stats?.total_movements ?? 0,
        }),
        [stats, officials],
    );

    useEffect(() => {
        try {
            const saved = localStorage.getItem(LAYOUT_KEY);
            if (saved === 'grid' || saved === 'list') setLayout(saved);
        } catch {
            /* storage unavailable */
        }
    }, []);

    function changeLayout(next: OfficialCardLayout) {
        setLayout(next);
        try {
            localStorage.setItem(LAYOUT_KEY, next);
        } catch {
            /* storage unavailable */
        }
    }

    function changeFilters(next: SmartFilterValue) {
        const previousUrl = govtListUrl(value);
        setValue(next);
        const url = govtListUrl(next);
        if (url === previousUrl) return;
        router.replace({ url, preserveState: true, preserveScroll: true });
    }

    const resetFilters = () => changeFilters({ search: '', filters: {}, sort: value.sort });

    function showScoreboardTile(tile: GovtScoreboardTile | null) {
        changeFilters(selectScoreboardTile(value, tile));
        const box = filtersRef.current;
        if (!box || box.getBoundingClientRect().bottom <= window.innerHeight * 0.7) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        box.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    return (
        <MainLayout>
            <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/10 via-background to-background py-12 md:py-16">
                <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
                    <div className="mb-4 flex justify-center">
                        <a
                            href="https://jard.chat"
                            target="_blank"
                            rel="noopener noreferrer"
                            dir="ltr"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-2xs transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <span>Supported by jard.chat</span>
                            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                        </a>
                    </div>
                    <div className="mb-4 flex items-center justify-center gap-3">
                        <span
                            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary md:h-12 md:w-12"
                            aria-hidden="true"
                        >
                            <IdCard className="h-6 w-6 md:h-7 md:w-7" />
                        </span>
                        <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground md:text-5xl">
                            السير الذاتية للمسؤولين
                        </h1>
                    </div>
                    <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                        دليل موثّق للسير الذاتية والمناصب الحكومية في سوريا منذ{' '}
                        <span dir="ltr" className="tabular-nums font-medium text-foreground">
                            8
                        </span>{' '}
                        كانون الأول{' '}
                        <span dir="ltr" className="tabular-nums font-medium text-foreground">
                            2024
                        </span>
                        ، يرصد التعيينات والتنقلات والمراسيم والمصادر الرسمية لكل مسؤول.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                        <Button
                            type="button"
                            className="gap-2"
                            onClick={() => setSuggestOpen(true)}
                        >
                            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
                            إضافة / اقتراح تعديل
                        </Button>
                        <Button asChild variant="outline" className="gap-2">
                            <Link href="/govtcvs/movements">
                                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                                سجل التعيينات والتنقلات
                            </Link>
                        </Button>
                        {canAdmin && (
                            <Button asChild variant="secondary" className="gap-2">
                                <Link href="/admin/govtcvs">
                                    <Settings className="h-4 w-4" aria-hidden="true" />
                                    لوحة الإدارة
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </section>

            <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
                <Scoreboard
                    stats={resolvedStats}
                    active={activeScoreboardTile(value)}
                    onSelect={showScoreboardTile}
                />

                <div
                    ref={filtersRef}
                    className="scroll-mt-20 rounded-xl border border-input bg-card shadow-sm transition-colors focus-within:border-foreground/25"
                >
                    <div
                        className="flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border/70 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
                        role="group"
                        aria-label="تصفية حسب الحالة"
                    >
                        {[{ value: 'all', label: 'الكل', count: base.length }, ...statusOptions].map(
                            (option) => {
                                const active =
                                    option.value === 'all'
                                        ? selectedStatuses.length === 0
                                        : selectedStatuses.includes(option.value);
                                return (
                                    <FilterChip
                                        key={option.value}
                                        active={active}
                                        activeVariant="outline"
                                        className={cn(
                                            'min-h-9 shrink-0 gap-1.5 rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap shadow-none transition-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-1 focus-visible:ring-border',
                                            active
                                                ? 'border-foreground/15 bg-muted/60 text-foreground'
                                                : 'border-border/70 bg-transparent text-muted-foreground',
                                        )}
                                        onClick={() => {
                                            if (option.value === 'all') changeFilters(searchValue);
                                            else if (statusFacet)
                                                changeFilters(
                                                    toggleFilterValue(value, statusFacet, option.value),
                                                );
                                        }}
                                    >
                                        {option.label}
                                        <span className="text-xs tabular-nums">{option.count}</span>
                                    </FilterChip>
                                );
                            },
                        )}
                    </div>
                    <SmartFilterSearch
                        embedded
                        mobileFiltersScroll
                        facets={searchFacets}
                        value={value}
                        onChange={changeFilters}
                        placeholder="ابحث باسم المسؤول أو المنصب أو الجهة الحكومية..."
                        ariaLabel="ابحث في السير الذاتية للمسؤولين"
                    />
                </div>

                <div className="flex items-center justify-between gap-3">
                    <p
                        className="me-auto min-w-0 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {visible.length === officials.length
                            ? `عدد المسؤولين: ${officials.length}`
                            : `المسؤولون المعروضون: ${visible.length} من أصل ${officials.length}`}
                    </p>
                    <Select
                        value={value.sort}
                        onValueChange={(sort) => changeFilters({ ...value, sort })}
                    >
                        <SelectTrigger
                            aria-label="ترتيب المسؤولين"
                            className="h-10 w-auto shrink-0 gap-2 border-0 px-1.5 text-muted-foreground shadow-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {SORT_OPTIONS.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                    className="focus:bg-muted/50 focus:text-foreground data-[highlighted]:bg-muted/50 data-[highlighted]:text-foreground"
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div
                        role="group"
                        aria-label="طريقة العرض"
                        className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border/70 p-0.5"
                    >
                        {LAYOUT_OPTIONS.map(({ value: option, label, icon: Icon }) => (
                            <Button
                                key={option}
                                variant="ghost"
                                size="icon"
                                aria-label={label}
                                title={label}
                                aria-pressed={layout === option}
                                onClick={() => changeLayout(option)}
                                className={cn(
                                    'h-8 w-8 focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0',
                                    layout === option
                                        ? 'bg-foreground/10 text-foreground'
                                        : 'text-muted-foreground',
                                )}
                            >
                                <Icon aria-hidden="true" />
                            </Button>
                        ))}
                    </div>
                </div>

                {visible.length > 0 ? (
                    <div
                        className={
                            layout === 'list'
                                ? 'flex flex-col gap-2 sm:gap-3'
                                : 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
                        }
                    >
                        {visible.map((official) => (
                            <OfficialCard
                                key={official.id}
                                official={official}
                                layout={layout}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                            <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                            <p className="font-semibold text-foreground">
                                {officials.length === 0
                                    ? 'لم يُنشر أي ملف لمسؤول بعد'
                                    : 'لا يوجد مسؤولون يطابقون خيارات البحث والتصفية الحالية'}
                            </p>
                            {officials.length > 0 && (
                                <Button variant="outline" onClick={resetFilters}>
                                    إعادة ضبط التصفية
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            <DirectorySuggestionDialog
                module="govtcvs"
                open={suggestOpen}
                onOpenChange={setSuggestOpen}
                targets={suggestionTargets}
            />
        </MainLayout>
    );
}
