import { useMemo, useState } from 'react';
import { Link } from '@inertiajs/react';
import {
    Calendar,
    ChevronLeft,
    FileText,
    GitBranch,
    History,
    Landmark,
} from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { FilterChip } from '@/Components/ui/filter-chip';
import { formatGovtDate } from '@/Domain/govtcvs/constants';
import {
    RESTRUCTURING_KIND_LABELS,
    holderActiveInEra,
    type GovernmentEra,
    type MinistryHolder,
    type MinistryRestructuring,
    type MinistrySummary,
} from '@/Domain/ministries/types';
import { cn } from '@/Lib/utils';

interface GovernmentTimelineProps {
    eras: GovernmentEra[];
    ministries: MinistrySummary[];
    restructurings: MinistryRestructuring[];
}

interface EraEventItem {
    key: string;
    ministrySlug: string;
    ministryName: string;
    ministryKind: MinistrySummary['kind'];
    holder: MinistryHolder;
    isNewInEra: boolean;
}

/**
 * Semantic, accessible four-era timeline of Syrian governments (2024–2026).
 *
 * - Mobile: vertical ordered timeline with era headings and clear visual rails.
 * - Wide screens: 4-column comparative grid (or single focused column when an era chip is selected).
 * - All eras and items remain in the SSR HTML; filter chips only hide non-matching eras visually.
 */
export function GovernmentTimeline({
    eras,
    ministries,
    restructurings,
}: GovernmentTimelineProps) {
    const [selectedEra, setSelectedEra] = useState<string>('all');

    // Avoid duplicating pre-merger energy/economy holders twice in the same era:
    // keep historical portfolios (electricity, oil, water, internal-trade, economy-and-industry, prime-minister)
    // in their own eras, and skip their copied predecessor entries on energy/economy/industry.
    const eraBlocks = useMemo(() => {
        const historicalHolderKeys = new Set<string>();
        for (const m of ministries) {
            if (m.status !== 'current') {
                for (const h of m.holders) {
                    historicalHolderKeys.add(`${h.name}|${h.start_date}|${h.end_date ?? ''}`);
                }
            }
        }

        return eras.map((era) => {
            const items: EraEventItem[] = [];
            const seenInEra = new Set<string>();

            for (const m of ministries) {
                for (const h of m.holders) {
                    if (!holderActiveInEra(h, era)) continue;
                    const sig = `${h.name}|${h.start_date}|${h.end_date ?? ''}`;
                    // If this exact tenure belongs to a dedicated historical ministry page, show it under that historical ministry.
                    if (m.status === 'current' && historicalHolderKeys.has(sig)) {
                        continue;
                    }
                    const uniqueKey = `${era.id}:${m.slug}:${h.name}:${h.start_date ?? ''}`;
                    if (seenInEra.has(uniqueKey)) continue;
                    seenInEra.add(uniqueKey);

                    const isNewInEra =
                        h.era === era.id ||
                        (Boolean(h.start_date) &&
                            h.start_date! >= era.start_date &&
                            (!era.end_date || h.start_date! < era.end_date));

                    items.push({
                        key: uniqueKey,
                        ministrySlug: m.slug,
                        ministryName: m.name_ar,
                        ministryKind: m.kind,
                        holder: h,
                        isNewInEra,
                    });
                }
            }

            // New appointments / changes in this era first, then continuing ministers by ministry priority
            items.sort((a, b) => {
                if (a.isNewInEra !== b.isNewInEra) return a.isNewInEra ? -1 : 1;
                const dateA = a.holder.start_date ?? '';
                const dateB = b.holder.start_date ?? '';
                if (dateA !== dateB) return dateB.localeCompare(dateA);
                return a.ministryName.localeCompare(b.ministryName, 'ar');
            });

            const eraRestructurings = restructurings.filter((r) => {
                if (era.id === 'al_jalali') return false;
                if (era.id === 'al_bashir') return r.date >= '2024-12-10' && r.date < '2025-03-29';
                if (era.id === 'transitional_2025') return r.date >= '2025-03-29' && r.date < '2026-05-09';
                return r.date >= '2026-05-09';
            });

            const newCount = items.filter((i) => i.isNewInEra).length;

            return {
                era,
                items,
                newCount,
                restructurings: eraRestructurings,
            };
        });
    }, [eras, ministries, restructurings]);

    const isFiltered = selectedEra !== 'all';

    return (
        <div className="space-y-6">
            {/* Era filter chips — all content stays mounted in DOM/SSR; non-matching eras are only hidden visually */}
            <div
                role="group"
                aria-label="تصفية الخط الزمني حسب المرحلة الحكومية"
                className="flex flex-wrap items-center gap-2"
            >
                <FilterChip
                    active={selectedEra === 'all'}
                    onClick={() => setSelectedEra('all')}
                    className="min-h-10 rounded-full px-4 text-xs sm:text-sm"
                >
                    <span>جميع المراحل</span>
                    <span className="tabular-nums">({eras.length})</span>
                </FilterChip>
                {eraBlocks.map(({ era, newCount }) => (
                    <FilterChip
                        key={era.id}
                        active={selectedEra === era.id}
                        onClick={() => setSelectedEra(era.id)}
                        className="min-h-10 rounded-full px-4 text-xs sm:text-sm"
                    >
                        <span>{era.short_label_ar}</span>
                        <span className="tabular-nums">({newCount})</span>
                    </FilterChip>
                ))}
            </div>

            <p className="sr-only" role="status" aria-live="polite">
                {selectedEra === 'all'
                    ? `عرض جميع المراحل الحكومية الأربع (${eras.length} مراحل).`
                    : `عرض مرحلة ${eras.find((e) => e.id === selectedEra)?.label_ar ?? ''}.`}
            </p>

            {/* Ordered timeline across the four eras: vertical rail on mobile, 4-column track on xl screens */}
            <ol
                className={cn(
                    'grid gap-6',
                    isFiltered
                        ? 'grid-cols-1'
                        : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4',
                )}
            >
                {eraBlocks.map(({ era, items, newCount, restructurings: eraChanges }, idx) => {
                    const isHidden = isFiltered && selectedEra !== era.id;
                    const newItems = items.filter((i) => i.isNewInEra);
                    const continuingItems = items.filter((i) => !i.isNewInEra);

                    return (
                        <li
                            key={era.id}
                            className={cn(
                                'relative flex flex-col',
                                isHidden && 'hidden',
                            )}
                        >
                            <Card className="flex h-full flex-col border-border/80 bg-card">
                                <CardHeader className="space-y-2.5 border-b border-border/70 bg-muted/25 p-4 sm:p-5">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-bold text-foreground">
                                            <History className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                            <span>المرحلة {idx + 1}</span>
                                        </span>
                                        <span className="text-xs font-medium text-muted-foreground">
                                            <time dateTime={era.start_date}>
                                                {era.period_ar}
                                            </time>
                                        </span>
                                    </div>

                                    <h3 className="text-base font-bold leading-snug text-foreground">
                                        {era.label_ar}
                                    </h3>

                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                        {era.summary_ar}
                                    </p>

                                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 font-medium text-foreground">
                                            <Calendar className="h-3 w-3 text-primary" aria-hidden="true" />
                                            <time dateTime={era.start_date} className="tabular-nums">
                                                {formatGovtDate(era.start_date)}
                                            </time>
                                            <span>–</span>
                                            {era.end_date ? (
                                                <time dateTime={era.end_date} className="tabular-nums">
                                                    {formatGovtDate(era.end_date)}
                                                </time>
                                            ) : (
                                                <span>الآن</span>
                                            )}
                                        </span>
                                        <Badge variant="secondary" className="text-xs tabular-nums">
                                            {newCount} تعيين
                                        </Badge>
                                    </div>
                                </CardHeader>

                                <CardContent className="flex-1 space-y-4 p-4 sm:p-5">
                                    {/* Structural changes (mergers/splits/reshuffles) in this era */}
                                    {eraChanges.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
                                                <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                                                <span>أبرز التحوّلات الهيكلية</span>
                                            </p>
                                            <ol className="space-y-2">
                                                {eraChanges.map((change) => (
                                                    <li
                                                        key={change.id}
                                                        className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs"
                                                    >
                                                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                                                            <span className="font-bold text-foreground">
                                                                {change.title_ar}
                                                            </span>
                                                            <time
                                                                dateTime={change.date}
                                                                className="tabular-nums text-muted-foreground"
                                                            >
                                                                {formatGovtDate(change.date)}
                                                            </time>
                                                        </div>
                                                        <p className="mt-1 leading-relaxed text-muted-foreground">
                                                            {RESTRUCTURING_KIND_LABELS[change.kind] ?? change.kind}
                                                            {change.decree ? ` · ${change.decree}` : ''}
                                                        </p>
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )}

                                    {/* New appointments & reshuffles in this era */}
                                    <div className="space-y-2">
                                        <p className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                            <Landmark className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                            <span>التعيينات والوزراء في هذه المرحلة</span>
                                        </p>
                                        <ol className="space-y-2.5 border-s-2 border-border ps-3">
                                            {newItems.map((item) => (
                                                <li
                                                    key={item.key}
                                                    className="relative rounded-lg border border-border/70 bg-background p-3 text-xs"
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className="absolute -start-[19px] top-4 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
                                                    />
                                                    <div className="flex flex-wrap items-start justify-between gap-1.5">
                                                        <Link
                                                            href={`/ministries/${item.ministrySlug}`}
                                                            className="font-bold text-foreground hover:text-primary hover:underline"
                                                        >
                                                            {item.ministryName}
                                                        </Link>
                                                        {item.holder.is_current && era.id === 'current_2026' && (
                                                            <Badge variant="secondary" className="text-[11px]">
                                                                حالي
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    <p className="mt-1 font-semibold text-primary">
                                                        {item.holder.govtcvs_url ? (
                                                            <Link
                                                                href={item.holder.govtcvs_url}
                                                                className="hover:underline"
                                                            >
                                                                {item.holder.name}
                                                            </Link>
                                                        ) : (
                                                            item.holder.name
                                                        )}
                                                    </p>

                                                    <p className="mt-0.5 text-muted-foreground">
                                                        {item.holder.title}
                                                    </p>

                                                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                                                        {item.holder.start_date && (
                                                            <span>
                                                                <time
                                                                    dateTime={item.holder.start_date}
                                                                    className="tabular-nums"
                                                                >
                                                                    {formatGovtDate(item.holder.start_date)}
                                                                </time>
                                                                {' ← '}
                                                                {item.holder.end_date ? (
                                                                    <time
                                                                        dateTime={item.holder.end_date}
                                                                        className="tabular-nums"
                                                                    >
                                                                        {formatGovtDate(item.holder.end_date)}
                                                                    </time>
                                                                ) : (
                                                                    <span>الآن</span>
                                                                )}
                                                            </span>
                                                        )}
                                                        {item.holder.decree && (
                                                            <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                                                                {item.holder.decree}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                                        <Link
                                                            href={`/ministries/${item.ministrySlug}`}
                                                            className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                                                        >
                                                            <span>صفحة الوزارة</span>
                                                            <ChevronLeft className="h-3 w-3" aria-hidden="true" />
                                                        </Link>
                                                        {item.holder.govtcvs_url && (
                                                            <Link
                                                                href={item.holder.govtcvs_url}
                                                                className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                                                            >
                                                                <FileText className="h-3 w-3" aria-hidden="true" />
                                                                <span>السيرة</span>
                                                            </Link>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* Continuing ministers from previous era */}
                                    {continuingItems.length > 0 && (
                                        <details className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs">
                                            <summary className="cursor-pointer font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs">
                                                وزراء ومسؤولون مستمرون من المرحلة السابقة ({continuingItems.length})
                                            </summary>
                                            <ol className="mt-2.5 space-y-2 border-t border-border/60 pt-2.5">
                                                {continuingItems.map((item) => (
                                                    <li
                                                        key={item.key}
                                                        className="flex flex-wrap items-center justify-between gap-1.5"
                                                    >
                                                        <div className="min-w-0">
                                                            <Link
                                                                href={`/ministries/${item.ministrySlug}`}
                                                                className="font-semibold text-foreground hover:text-primary hover:underline"
                                                            >
                                                                {item.ministryName}
                                                            </Link>
                                                            <span className="mx-1 text-muted-foreground">·</span>
                                                            {item.holder.govtcvs_url ? (
                                                                <Link
                                                                    href={item.holder.govtcvs_url}
                                                                    className="text-primary hover:underline"
                                                                >
                                                                    {item.holder.name}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-muted-foreground">
                                                                    {item.holder.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {item.holder.start_date && (
                                                            <time
                                                                dateTime={item.holder.start_date}
                                                                className="shrink-0 tabular-nums text-muted-foreground"
                                                            >
                                                                منذ {formatGovtDate(item.holder.start_date)}
                                                            </time>
                                                        )}
                                                    </li>
                                                ))}
                                            </ol>
                                        </details>
                                    )}
                                </CardContent>
                            </Card>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
}
