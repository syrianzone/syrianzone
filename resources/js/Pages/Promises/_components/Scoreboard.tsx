import type { ReactNode } from 'react';
import { Card, CardContent } from '@/Components/ui/card';
import { cn } from '@/Lib/utils';
import type { PromiseStateFilter } from '../_lib/filters';
import type { PromiseStats } from '@/Domain/promises/types';

/**
 * Global totals, independent of the active list filters. Every promise falls
 * in exactly one tile after the total, so the tiles add up. Each tile is a
 * toggle that narrows the list to its promises; `active` is the state the list
 * shows exactly, if any. The total resets the list.
 */
export default function Scoreboard({ stats, active, onSelect }: {
    stats: PromiseStats;
    active: string | null | undefined;
    onSelect: (state: string | null) => void;
}) {
    const items: Array<{ state: PromiseStateFilter; label: string; value: number; tone?: string; note?: string }> = [
        { state: 'fulfilled', label: 'تحقق', value: stats.fulfilled, tone: 'text-primary', note: stats.keptLate > 0 ? `منها بعد الموعد: ${stats.keptLate}` : undefined },
        { state: 'partial', label: 'تحقق جزئياً', value: stats.partiallyFulfilled },
        { state: 'broken', label: 'لم يتحقق', value: stats.broken, tone: 'text-destructive' },
        { state: 'overdue', label: 'متأخر', value: stats.overdue, tone: 'text-destructive' },
        { state: 'open', label: 'لم يُحسم بعد', value: stats.open },
        { state: 'other', label: 'أُجّل أو سُحب', value: stats.postponed + stats.retracted },
    ];

    return (
        <Card>
            <CardContent className="grid grid-cols-2 gap-y-3 p-3 sm:grid-cols-4 lg:grid-cols-7" role="group" aria-label="عرض الوعود حسب الحالة">
                <div className="col-span-2 flex sm:col-span-4 lg:col-span-1 lg:border-e lg:border-border lg:pe-3">
                    <Tile onClick={() => onSelect(null)} className="flex-1 justify-center">
                        <span className="text-4xl font-black tabular-nums text-foreground">{stats.total}</span>
                        <span className="mt-1 text-xs font-medium text-muted-foreground">إجمالي الوعود</span>
                    </Tile>
                </div>
                {items.map((item) => (
                    <Tile key={item.state} pressed={active === item.state} onClick={() => onSelect(item.state)}>
                        <span className={cn('text-3xl font-black tabular-nums', item.tone ?? 'text-foreground')}>{item.value}</span>
                        <span className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</span>
                        {item.note && <span className="text-[11px] text-muted-foreground">{item.note}</span>}
                    </Tile>
                ))}
            </CardContent>
        </Card>
    );
}

/** A state tile is a toggle (`pressed`); the total is a plain "show all" button. */
function Tile({ pressed, onClick, className, children }: { pressed?: boolean; onClick: () => void; className?: string; children: ReactNode }) {
    return (
        <button type="button" aria-pressed={pressed} onClick={onClick}
            className={cn(
                'flex cursor-pointer flex-col items-center rounded-lg p-2 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pressed && 'bg-foreground/10 hover:bg-foreground/10',
                className,
            )}>
            {children}
        </button>
    );
}
