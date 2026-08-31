import { Clock, Globe2, MapPin, Share2, X } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { cn } from '@/lib/utils';
import { StatusPill } from './StatusPill';
import { WhatsAppIcon } from './WhatsAppIcon';
import { formatIntl, isWindowOpen, shareCrossing, statusOf, windowLabel, type Crossing } from '../_lib/crossings';

/**
 * The card that opens over the map once a crossing is picked, from either view.
 *
 * A hover preview passes interactive={false}: the card sits where a pin near the
 * top of the map may be, and if it could take the pointer it would trigger the
 * pin's mouseleave and flicker itself in and out. Clicking pins a crossing,
 * which is when the buttons become usable.
 */
export function CrossingDetail({
    crossing,
    nowMin,
    interactive = true,
    onClose,
}: {
    crossing: Crossing;
    nowMin: number | null;
    interactive?: boolean;
    onClose: () => void;
}) {
    const status = statusOf(crossing, nowMin);

    return (
        <div
            className={cn(
                'w-full max-w-sm rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur',
                interactive ? 'pointer-events-auto' : 'pointer-events-none'
            )}
        >
            <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="font-bold leading-snug text-foreground">{crossing.name}</h2>
                    {crossing.country && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Globe2 className="h-3.5 w-3.5" />
                            الدولة المقابلة: <span className="font-semibold text-foreground">{crossing.country}</span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <StatusPill status={status} />
                    {interactive && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} title="إغلاق">
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            {!crossing.openingSoon && (
                <>
                    {crossing.opType && (
                        <span className="mb-2 inline-block rounded-lg bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {crossing.opType}
                        </span>
                    )}

                    {crossing.override?.message && (
                        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                            {crossing.override.message}
                        </p>
                    )}

                    <div className="mb-3 space-y-1.5 text-sm">
                        {crossing.windows.map((win, i) => {
                            const open = nowMin === null ? null : isWindowOpen(win, nowMin);
                            return (
                                <div key={i} className="flex items-center gap-2 text-muted-foreground">
                                    {crossing.windows.length > 1 ? (
                                        <span
                                            className={cn(
                                                'h-1.5 w-1.5 shrink-0 rounded-full',
                                                open === null ? 'bg-muted-foreground/40' : open ? 'bg-emerald-500' : 'bg-red-500'
                                            )}
                                        />
                                    ) : (
                                        <Clock className="h-3.5 w-3.5 shrink-0" />
                                    )}
                                    <span>{win.label ? `${win.label}:` : 'ساعات العمل:'}</span>
                                    <span className="font-semibold text-foreground">{windowLabel(win)}</span>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            <div className="mb-2 text-sm font-semibold tabular-nums text-muted-foreground" dir="ltr">
                {formatIntl(crossing.intl)}
            </div>

            <Button asChild className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                <a href={`https://wa.me/${crossing.intl}`} target="_blank" rel="noopener noreferrer">
                    <WhatsAppIcon className="h-4 w-4" />
                    واتساب
                </a>
            </Button>

            <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" asChild>
                    <a href={crossing.mapsUrl} target="_blank" rel="noopener noreferrer">
                        <MapPin className="h-4 w-4" />
                        الموقع
                    </a>
                </Button>
                <Button variant="outline" onClick={() => shareCrossing(crossing)}>
                    <Share2 className="h-4 w-4" />
                    مشاركة
                </Button>
            </div>
        </div>
    );
}
