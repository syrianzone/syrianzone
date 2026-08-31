import { cn } from '@/lib/utils';
import { StatusDot } from './StatusPill';
import { WhatsAppIcon } from './WhatsAppIcon';
import {
    DIRECTION_LABELS,
    DIRECTION_ORDER,
    formatIntl,
    statusOf,
    windowLabel,
    type Crossing,
    type Direction,
} from '../_lib/crossings';

/** One line of hours for the row: the h24 case and the multi-window case both
 *  collapse, because the full breakdown lives in the detail card. */
function hoursSummary(crossing: Crossing) {
    if (crossing.openingSoon) return '—';
    if (crossing.windows.length === 0) return '—';
    if (crossing.windows.length === 1) return windowLabel(crossing.windows[0]);
    return `${crossing.windows.length} فترات عمل`;
}

export function CrossingsTable({
    crossings,
    nowMin,
    selectedId,
    onSelect,
}: {
    crossings: Crossing[];
    nowMin: number | null;
    selectedId: number | null;
    onSelect: (n: number) => void;
}) {
    const groups = DIRECTION_ORDER.map((direction) => ({
        direction,
        list: crossings.filter((c) => c.direction === direction),
    })).filter((group) => group.list.length > 0);

    if (groups.length === 0) {
        return <p className="px-4 py-10 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة لبحثك.</p>;
    }

    return (
        <div className="divide-y divide-border">
            {groups.map((group) => (
                <section key={group.direction}>
                    <h2 className="z-10 flex items-center justify-between gap-2 border-y border-border bg-muted/80 px-4 py-2 text-xs font-bold text-muted-foreground backdrop-blur lg:sticky lg:top-0">
                        {DIRECTION_LABELS[group.direction as Direction]}
                        <span className="tabular-nums">{group.list.length}</span>
                    </h2>

                    <ul>
                        {group.list.map((crossing) => {
                            const status = statusOf(crossing, nowMin);
                            const selected = selectedId === crossing.n;

                            return (
                                // the whatsapp link sits beside the row button, not inside it:
                                // a button may not contain interactive content
                                <li key={crossing.n} className={cn('relative border-b border-border/60', selected && 'bg-accent')}>
                                    <button
                                        type="button"
                                        onClick={() => onSelect(crossing.n)}
                                        aria-current={selected}
                                        className="w-full px-4 py-3 pb-8 text-start transition-colors hover:bg-accent/60"
                                    >
                                        <div className="flex items-center gap-2">
                                            <StatusDot status={status} />
                                            <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                                                {crossing.name}
                                            </span>
                                            {crossing.country && (
                                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                                    {crossing.country}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-1.5 truncate pe-24 ps-4 text-xs text-muted-foreground">
                                            {hoursSummary(crossing)}
                                        </div>
                                    </button>

                                    <a
                                        href={`https://wa.me/${crossing.intl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={`واتساب ${formatIntl(crossing.intl)}`}
                                        className="absolute bottom-2.5 end-4 inline-flex items-center gap-1 rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
                                    >
                                        <WhatsAppIcon className="h-3.5 w-3.5" />
                                        واتساب
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
        </div>
    );
}
