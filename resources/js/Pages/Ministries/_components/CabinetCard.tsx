import { Link } from '@inertiajs/react';
import { Calendar, ChevronLeft, FileText, Landmark } from 'lucide-react';
import { Card, CardContent } from '@/Components/ui/card';
import { Badge } from '@/Components/ui/badge';
import OfficialAvatar from '@/Domain/govtcvs/OfficialAvatar';
import { formatGovtDate } from '@/Domain/govtcvs/constants';
import {
    MINISTRY_STATUS_LABELS,
    type MinistrySummary,
} from '@/Domain/ministries/types';

interface CabinetCardProps {
    ministry: MinistrySummary;
    priority?: boolean;
}

export function CabinetCard({ ministry, priority = false }: CabinetCardProps) {
    const holder = ministry.current_holder;

    return (
        <Card className="flex h-full flex-col justify-between border-border/80 bg-card transition-colors hover:border-primary/40">
            <CardContent className="flex flex-1 flex-col justify-between gap-4 p-5">
                <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold leading-snug text-foreground">
                            <Link
                                href={`/ministries/${ministry.slug}`}
                                className="hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xs"
                            >
                                {ministry.name_ar}
                            </Link>
                        </h3>
                        {ministry.status !== 'current' && (
                            <Badge variant="outline" className="shrink-0 text-xs">
                                {MINISTRY_STATUS_LABELS[ministry.status]}
                            </Badge>
                        )}
                    </div>

                    {holder ? (
                        <div className="flex items-center gap-3">
                            <OfficialAvatar
                                name={holder.name}
                                resolvedPortraitUrl={holder.portrait_url}
                                size={52}
                                priority={priority}
                                className="ring-2 ring-border/70"
                            />
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="truncate text-sm font-bold text-foreground">
                                    {holder.name}
                                </p>
                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                    {holder.title}
                                </p>
                                {holder.start_date && (
                                    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                        <Calendar className="h-3 w-3 shrink-0" aria-hidden="true" />
                                        <span>منذ</span>
                                        <time
                                            dateTime={holder.start_date}
                                            className="tabular-nums font-medium text-foreground"
                                        >
                                            {formatGovtDate(holder.start_date)}
                                        </time>
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                            <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>
                                {ministry.lineage_summary_ar ?? 'وزارة تاريخية أُعيد تنظيمها ضمن التعديلات الوزارية.'}
                            </span>
                        </div>
                    )}

                    {holder?.decree && (
                        <p className="text-xs text-muted-foreground">
                            <span className="inline-flex items-center rounded-md border border-border bg-muted/50 px-2 py-0.5 font-medium text-foreground">
                                {holder.decree}
                            </span>
                        </p>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 text-xs">
                    <Link
                        href={`/ministries/${ministry.slug}`}
                        className="inline-flex min-h-9 items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    >
                        <span>تاريخ الوزارة والحسابات</span>
                        <ChevronLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </Link>

                    {holder?.govtcvs_url && (
                        <Link
                            href={holder.govtcvs_url}
                            className="inline-flex min-h-9 items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>السيرة الذاتية</span>
                        </Link>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
