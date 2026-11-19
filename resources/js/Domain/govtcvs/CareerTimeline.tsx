import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import {
    ArrowLeft,
    BadgeCheck,
    Building2,
    CalendarDays,
    FileSignature,
    History,
} from 'lucide-react';
import { cn } from '@/Lib/utils';
import { PhaseBadge, TierBadge } from './StatusBadges';
import {
    DATE_PRECISION_LABELS,
    END_REASON_META,
    formatGovtDate,
    TENURE_STATUS_LABELS,
} from './constants';
import type { GovtDatePrecision, GovtEndReason, GovtEvidenceItem, GovtTenureItem } from './types';

interface Props {
    tenures: GovtTenureItem[];
    evidenceLinks?: GovtEvidenceItem[];
}

/**
 * RTL vertical timeline showing every post-8-Dec-2024 office held with date range,
 * decree reference, end reason, and clickable predecessor/successor links.
 */
export default function CareerTimeline({ tenures }: Props) {
    if (tenures.length === 0) {
        return (
            <p className="py-6 text-center text-sm text-muted-foreground">
                لم تُسجَّل مناصب حكومية موثّقة لهذا المسؤول بعد.
            </p>
        );
    }

    return (
        <ol className="relative space-y-6 border-s border-border ps-6">
            {tenures.map((tenure) => {
                const isCurrent = tenure.status === 'current';
                const endMeta = tenure.end_reason
                    ? END_REASON_META[tenure.end_reason as GovtEndReason]
                    : null;
                const startPrecisionLabel =
                    tenure.start_date_precision && tenure.start_date_precision !== 'exact'
                        ? DATE_PRECISION_LABELS[tenure.start_date_precision as GovtDatePrecision]
                        : null;

                return (
                    <li key={tenure.id} className="relative">
                        <span
                            className={cn(
                                'absolute -start-[calc(2rem+0.5px)] top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background',
                                isCurrent
                                    ? 'bg-primary text-primary-foreground'
                                    : 'border-2 border-border bg-muted text-muted-foreground',
                            )}
                            aria-hidden="true"
                        >
                            {isCurrent ? (
                                <BadgeCheck className="h-2.5 w-2.5" />
                            ) : (
                                <History className="h-2.5 w-2.5" />
                            )}
                        </span>

                        <div className="space-y-3 rounded-xl border border-border bg-card p-4 shadow-2xs">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-base font-bold text-foreground">
                                            {tenure.role_title_ar}
                                        </h3>
                                        {tenure.is_acting && (
                                            <Badge variant="outline" className="text-xs">
                                                بالتكليف
                                            </Badge>
                                        )}
                                        <Badge variant={isCurrent ? 'default' : 'secondary'} className="text-xs">
                                            {TENURE_STATUS_LABELS[tenure.status] ?? tenure.status}
                                        </Badge>
                                    </div>
                                    {tenure.institution_name_ar && (
                                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                            <span>{tenure.institution_name_ar}</span>
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5">
                                    <TierBadge tier={tenure.tier} short />
                                    <PhaseBadge phase={tenure.government_phase} short />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                                <span className="inline-flex items-center gap-1.5">
                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                    <span>
                                        من:{' '}
                                        <strong className="font-semibold text-foreground tabular-nums">
                                            {tenure.started_at
                                                ? formatGovtDate(tenure.started_at, tenure.start_date_precision)
                                                : 'غير محدد'}
                                        </strong>
                                        {startPrecisionLabel && (
                                            <span className="ms-1 text-muted-foreground">
                                                ({startPrecisionLabel})
                                            </span>
                                        )}
                                    </span>
                                </span>

                                {tenure.ended_at ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <span>إلى:</span>
                                        <strong className="font-semibold text-foreground tabular-nums">
                                            {formatGovtDate(tenure.ended_at, tenure.end_date_precision)}
                                        </strong>
                                    </span>
                                ) : isCurrent ? (
                                    <span className="font-medium text-primary">حتى الآن</span>
                                ) : null}

                                {tenure.start_decree_ref && (
                                    <Badge variant="outline" className="gap-1 font-normal">
                                        <FileSignature className="h-3 w-3" aria-hidden="true" />
                                        <span>تعيين: {tenure.start_decree_ref}</span>
                                    </Badge>
                                )}

                                {tenure.end_decree_ref && (
                                    <Badge variant="outline" className="gap-1 font-normal">
                                        <FileSignature className="h-3 w-3" aria-hidden="true" />
                                        <span>إنهاء: {tenure.end_decree_ref}</span>
                                    </Badge>
                                )}

                                {endMeta && (
                                    <Badge variant={endMeta.variant} className="text-xs">
                                        سبب الانتهاء: {endMeta.label}
                                    </Badge>
                                )}
                            </div>

                            {(tenure.predecessor || tenure.successor) && (
                                <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
                                    {tenure.predecessor && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground">سبقه في المنصب:</span>
                                            <Link
                                                href={`/govtcvs/${tenure.predecessor.official_slug}`}
                                                className="font-semibold text-primary hover:underline"
                                            >
                                                {tenure.predecessor.official_name_ar}
                                            </Link>
                                        </div>
                                    )}
                                    {tenure.predecessor && tenure.successor && (
                                        <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                    )}
                                    {tenure.successor && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground">خلفه في المنصب:</span>
                                            <Link
                                                href={`/govtcvs/${tenure.successor.official_slug}`}
                                                className="font-semibold text-primary hover:underline"
                                            >
                                                {tenure.successor.official_name_ar}
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            {tenure.notes_ar && (
                                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                                    {tenure.notes_ar}
                                </p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
