import { Link } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import { Building2, CalendarDays, History } from 'lucide-react';
import { cn } from '@/Lib/utils';
import OfficialAvatar from './OfficialAvatar';
import { CvCompletenessBadge, OfficeStatusBadge } from './StatusBadges';
import { formatGovtDate, TIER_LABELS } from './constants';
import type { GovtOfficialSummary } from './types';

export type OfficialCardLayout = 'grid' | 'list';

interface Props {
    official: GovtOfficialSummary;
    layout?: OfficialCardLayout;
    className?: string;
}

/**
 * Scannable card for the `/govtcvs` grid and list views.
 * Uses a stretched `<Link>` on the heading so the entire card is clickable
 * without nesting interactive controls.
 */
export default function OfficialCard({ official, layout = 'grid', className }: Props) {
    const list = layout === 'list';
    const activeTenure = official.current_tenure ?? official.latest_tenure;
    const roleTitle = activeTenure?.role_title_ar ?? TIER_LABELS[official.highest_tier] ?? 'مسؤول حكومي';
    const institutionName = activeTenure?.institution_name_ar;
    const fullTitle = [official.honorific_ar, official.display_name_ar || official.full_name_ar]
        .filter(Boolean)
        .join(' ');

    return (
        <Card
            className={cn(
                'group relative flex h-full transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring',
                list ? 'flex-row' : 'flex-col',
                className,
            )}
        >
            <CardContent
                className={cn(
                    'flex flex-1 flex-col',
                    list ? 'min-w-0 gap-2 p-3.5 sm:gap-3 sm:p-5' : 'gap-4 p-5',
                )}
            >
                <div className={cn('flex justify-between gap-3', list ? 'items-center' : 'items-start')}>
                    <div className="flex min-w-0 items-center gap-3">
                        <OfficialAvatar
                            name={official.display_name_ar || official.full_name_ar}
                            portraitUrl={official.portrait_url}
                            resolvedPortraitUrl={official.resolved_portrait_url}
                            size={list ? 44 : 52}
                        />
                        <div className="min-w-0">
                            <h2 className="text-base font-bold leading-snug text-foreground">
                                <Link
                                    href={`/govtcvs/${official.slug}`}
                                    className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-primary"
                                >
                                    {fullTitle}
                                </Link>
                            </h2>
                            {official.full_name_en && (
                                <p className="truncate text-xs text-muted-foreground">
                                    <span dir="ltr">{official.full_name_en}</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <OfficeStatusBadge status={official.office_status} className="shrink-0" />
                </div>

                <div
                    className={cn(
                        'rounded-lg bg-muted/40 p-3',
                        list
                            ? 'flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5'
                            : 'space-y-1.5',
                    )}
                >
                    <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-foreground">{roleTitle}</p>
                        {activeTenure?.is_acting && (
                            <Badge variant="outline" className="text-[11px]">
                                بالتكليف
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {institutionName && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{institutionName}</span>
                            </p>
                        )}
                        {activeTenure?.started_at && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>
                                    منذ{' '}
                                    <span className="tabular-nums">
                                        {formatGovtDate(activeTenure.started_at, activeTenure.start_date_precision)}
                                    </span>
                                    {activeTenure.ended_at && (
                                        <>
                                            {' '}حتى{' '}
                                            <span className="tabular-nums">
                                                {formatGovtDate(activeTenure.ended_at, activeTenure.end_date_precision)}
                                            </span>
                                        </>
                                    )}
                                </span>
                            </p>
                        )}
                    </div>
                </div>

                {official.bio_summary_ar && (
                    <p
                        className={cn(
                            'text-xs leading-relaxed text-muted-foreground',
                            list ? 'line-clamp-1 max-sm:hidden' : 'line-clamp-2',
                        )}
                    >
                        {official.bio_summary_ar}
                    </p>
                )}

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <CvCompletenessBadge completeness={official.cv_completeness} short />
                    <div className="flex items-center gap-1.5">
                        {official.tenures_count > 1 && (
                            <Badge variant="outline" className="gap-1 text-[11px] font-medium">
                                <History className="h-3 w-3" aria-hidden="true" />
                                <span dir="ltr" className="tabular-nums">{official.tenures_count}</span> مناصب
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
