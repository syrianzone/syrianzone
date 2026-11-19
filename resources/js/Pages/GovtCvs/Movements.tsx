import { useMemo, useState } from 'react';
import { Link, router, usePage, useRemember } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import SmartFilterSearch from '@/Components/SmartFilterSearch';
import {
    ArrowLeft,
    ArrowLeftRight,
    ArrowRight,
    Building2,
    CalendarDays,
    ExternalLink,
    FileSignature,
    SearchX,
} from 'lucide-react';
import { toggleFilterValue, type SmartFilterValue } from '@/Lib/smartFilterSearch';
import { cn } from '@/Lib/utils';
import OfficialAvatar from '@/Domain/govtcvs/OfficialAvatar';
import { OfficeStatusBadge, PhaseBadge, TierBadge } from '@/Domain/govtcvs/StatusBadges';
import {
    END_REASON_META,
    formatGovtDate,
    MOVEMENT_KIND_META,
    safeHref,
} from '@/Domain/govtcvs/constants';
import type {
    GovtCvsStats,
    GovtEndReason,
    GovtMovementItem,
    InstitutionOption,
} from '@/Domain/govtcvs/types';
import {
    filterMovements,
    matchesMovementKind,
    MOVEMENT_SORT_OPTIONS,
    movementFilterFacets,
    movementsListUrl,
    readMovementFilters,
    visibleMovements,
} from './_lib/movementFilters';

const INITIAL_VISIBLE_COUNT = 40;
const LOAD_MORE_STEP = 40;

interface Props {
    movements: GovtMovementItem[];
    stats?: GovtCvsStats;
    institutions: InstitutionOption[];
    filters?: {
        q?: string | null;
        kind?: string | null;
        phase?: string | null;
        tier?: string | null;
        institution?: string | null;
        institution_id?: string | null;
        end_reason?: string | null;
        sort?: string | null;
    };
}

export default function GovtCvsMovements({
    movements = [],
    institutions = [],
    filters = {},
}: Props) {
    const page = usePage();

    const facets = useMemo(() => movementFilterFacets(institutions), [institutions]);
    const initialValue = useMemo(
        () => readMovementFilters(page.url, facets, filters),
        [page.url, facets, filters],
    );
    const [value, setValue] = useRemember<SmartFilterValue>(
        initialValue,
        'govtcvs.movements.filters',
    );
    const [visibleLimit, setVisibleLimit] = useState(INITIAL_VISIBLE_COUNT);

    const base = useMemo(() => filterMovements(movements, value), [movements, value]);
    const visible = useMemo(() => visibleMovements(base, value), [base, value]);
    const displayed = useMemo(() => visible.slice(0, visibleLimit), [visible, visibleLimit]);
    const remaining = Math.max(0, visible.length - displayed.length);
    const kindFacet = useMemo(() => facets.find((facet) => facet.key === 'kind'), [facets]);
    const searchFacets = useMemo(() => facets.filter((facet) => facet.key !== 'kind'), [facets]);

    const kindOptions = useMemo(
        () =>
            kindFacet?.options.map((option) => ({
                ...option,
                count: base.filter((m) => matchesMovementKind(m, option.value)).length,
            })) ?? [],
        [kindFacet, base],
    );

    const { kind: selectedKinds = [], ...searchFilters } = value.filters;
    const searchValue = { ...value, filters: searchFilters };

    function changeFilters(next: SmartFilterValue) {
        const previousUrl = movementsListUrl(value);
        setValue(next);
        setVisibleLimit(INITIAL_VISIBLE_COUNT);
        const url = movementsListUrl(next);
        if (url === previousUrl) return;
        router.replace({ url, preserveState: true, preserveScroll: true });
    }

    const hasActiveFilters =
        value.search.trim() !== '' ||
        Object.values(value.filters).some((values) => values.length > 0);

    const resetFilters = () => changeFilters({ search: '', filters: {}, sort: value.sort });

    return (
        <MainLayout>
            <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-b from-primary/10 via-background to-background py-12 md:py-16">
                <div className="container relative z-10 mx-auto max-w-4xl px-4 text-center">
                    <div className="mb-3 flex justify-center">
                        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                            <Link href="/govtcvs">
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                العودة إلى دليل السير الذاتية للمسؤولين
                            </Link>
                        </Button>
                    </div>
                    <div className="mb-4 flex items-center justify-center gap-3">
                        <span
                            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary md:h-12 md:w-12"
                            aria-hidden="true"
                        >
                            <ArrowLeftRight className="h-6 w-6 md:h-7 md:w-7" />
                        </span>
                        <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground md:text-5xl">
                            سجل التعيينات والتنقلات
                        </h1>
                    </div>
                    <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                        رصد زمني للتعيينات والاستلام والتسليم والإعفاءات في المناصب الحكومية السورية منذ{' '}
                        <span dir="ltr" className="tabular-nums font-medium text-foreground">
                            8
                        </span>{' '}
                        كانون الأول{' '}
                        <span dir="ltr" className="tabular-nums font-medium text-foreground">
                            2024
                        </span>
                        .
                    </p>
                </div>
            </section>

            <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8">
                <div className="scroll-mt-20 rounded-xl border border-input bg-card shadow-sm transition-colors focus-within:border-foreground/25">
                    <div
                        className="flex flex-nowrap gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-border/70 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
                        role="group"
                        aria-label="تصفية حسب نوع الحركة"
                    >
                        {[{ value: 'all', label: 'الكل', count: base.length }, ...kindOptions].map(
                            (option) => {
                                const active =
                                    option.value === 'all'
                                        ? selectedKinds.length === 0
                                        : selectedKinds.includes(option.value);
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
                                            else if (kindFacet)
                                                changeFilters(
                                                    toggleFilterValue(value, kindFacet, option.value),
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
                        placeholder="ابحث باسم المسؤول أو المنصب أو الجهة أو رقم المرسوم..."
                        ariaLabel="ابحث في سجل التعيينات والتنقلات"
                    />
                </div>

                <div className="flex items-center justify-between gap-3">
                    <p
                        className="me-auto min-w-0 text-sm text-muted-foreground"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {visible.length === movements.length
                            ? `عدد الحركات: ${movements.length}`
                            : `الحركات المعروضة: ${visible.length} من أصل ${movements.length}`}
                    </p>
                    <Select
                        value={value.sort}
                        onValueChange={(sort) => changeFilters({ ...value, sort })}
                    >
                        <SelectTrigger
                            aria-label="ترتيب الحركات"
                            className="h-10 w-auto shrink-0 gap-2 border-0 px-1.5 text-muted-foreground shadow-none focus:ring-0 focus-visible:ring-1 focus-visible:ring-border focus-visible:ring-offset-0"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {MOVEMENT_SORT_OPTIONS.map((option) => (
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
                </div>

                {visible.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
                            <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
                            <p className="font-semibold text-foreground">
                                {movements.length === 0
                                    ? 'لم تُسجَّل حركات تعيين أو تنقّل بعد'
                                    : 'لا توجد حركات تطابق هذه التصفية'}
                            </p>
                            {hasActiveFilters && (
                                <Button variant="outline" onClick={resetFilters}>
                                    إعادة ضبط التصفية
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <ol className="relative space-y-4 border-s border-border ps-6">
                            {displayed.map((movement, idx) => {
                                const kindMeta =
                                    MOVEMENT_KIND_META[movement.movement_kind] ??
                                    MOVEMENT_KIND_META.appointment;
                                const endMeta = movement.end_reason
                                    ? END_REASON_META[movement.end_reason as GovtEndReason]
                                    : null;
                                const sourceHref = safeHref(movement.source_url);
                                const fullName = [
                                    movement.official_honorific_ar,
                                    movement.official_name_ar,
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                return (
                                    <li
                                        key={`${movement.tenure_id}-${movement.movement_kind}-${idx}`}
                                        className="relative"
                                    >
                                        <span
                                            className="absolute -start-[calc(1.875rem+0.5px)] top-5 h-3 w-3 rounded-full border-2 border-primary bg-background"
                                            aria-hidden="true"
                                        />
                                        <Card>
                                            <CardContent className="space-y-3 p-4 sm:p-5">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <Badge variant={kindMeta.variant}>
                                                            {kindMeta.label}
                                                        </Badge>
                                                        <TierBadge tier={movement.tier} short />
                                                        <PhaseBadge
                                                            phase={movement.government_phase}
                                                            short
                                                        />
                                                        {endMeta && (
                                                            <Badge variant={endMeta.variant}>
                                                                {endMeta.label}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {movement.date && (
                                                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                                            <CalendarDays
                                                                className="h-3.5 w-3.5"
                                                                aria-hidden="true"
                                                            />
                                                            <span className="tabular-nums font-medium text-foreground">
                                                                {formatGovtDate(
                                                                    movement.date,
                                                                    movement.date_precision,
                                                                )}
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                    <div className="flex items-center gap-3">
                                                        <OfficialAvatar
                                                            name={movement.official_name_ar}
                                                            portraitUrl={movement.official_portrait_url}
                                                            size={44}
                                                        />
                                                        <div>
                                                            <Link
                                                                href={`/govtcvs/${movement.official_slug}`}
                                                                className="text-base font-bold text-foreground hover:text-primary hover:underline"
                                                            >
                                                                {fullName}
                                                            </Link>
                                                            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                                                <span className="font-medium text-foreground">
                                                                    {movement.role_title_ar}
                                                                </span>
                                                                {movement.institution_name_ar && (
                                                                    <span className="inline-flex items-center gap-1 text-xs">
                                                                        <span>·</span>
                                                                        <Building2
                                                                            className="h-3.5 w-3.5"
                                                                            aria-hidden="true"
                                                                        />
                                                                        {movement.institution_name_ar}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <OfficeStatusBadge
                                                        status={movement.official_office_status}
                                                    />
                                                </div>

                                                {/* Predecessor -> Successor transition bar */}
                                                {(movement.predecessor || movement.successor) && (
                                                    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                                                        {movement.predecessor && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-muted-foreground">
                                                                    السلف:
                                                                </span>
                                                                <Link
                                                                    href={`/govtcvs/${movement.predecessor.official_slug}`}
                                                                    className="font-semibold text-primary hover:underline"
                                                                >
                                                                    {movement.predecessor.official_name_ar}
                                                                </Link>
                                                            </div>
                                                        )}
                                                        {movement.predecessor && movement.successor && (
                                                            <ArrowLeft
                                                                className="h-3.5 w-3.5 text-muted-foreground"
                                                                aria-hidden="true"
                                                            />
                                                        )}
                                                        {movement.successor && (
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-muted-foreground">
                                                                    الخلف:
                                                                </span>
                                                                <Link
                                                                    href={`/govtcvs/${movement.successor.official_slug}`}
                                                                    className="font-semibold text-primary hover:underline"
                                                                >
                                                                    {movement.successor.official_name_ar}
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {(movement.decree_ref || sourceHref) && (
                                                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5 text-xs">
                                                        {movement.decree_ref ? (
                                                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                                                                <FileSignature
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                                <span>المرجع: {movement.decree_ref}</span>
                                                            </span>
                                                        ) : (
                                                            <span />
                                                        )}

                                                        {sourceHref && (
                                                            <a
                                                                href={sourceHref}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                                                            >
                                                                <ExternalLink
                                                                    className="h-3.5 w-3.5"
                                                                    aria-hidden="true"
                                                                />
                                                                <span>المصدر الرسمي</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    </li>
                                );
                            })}
                        </ol>

                        {remaining > 0 && (
                            <div className="flex justify-center pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="lg"
                                    onClick={() =>
                                        setVisibleLimit((prev) => prev + LOAD_MORE_STEP)
                                    }
                                >
                                    عرض المزيد (تبقّى {remaining})
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </MainLayout>
    );
}
