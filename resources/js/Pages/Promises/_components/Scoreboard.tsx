import { Card, CardContent } from '@/Components/ui/card';
import { cn } from '@/Lib/utils';
import type { PromiseStats } from '../_lib/types';

/**
 * Global totals, independent of the active list filters. Every promise falls
 * in exactly one tile after the total, so the tiles add up.
 */
export default function Scoreboard({ stats }: { stats: PromiseStats }) {
    const items: Array<{ label: string; value: number; tone?: string; note?: string }> = [
        { label: 'تحقق', value: stats.fulfilled, tone: 'text-primary', note: stats.keptLate > 0 ? `منها بعد الموعد: ${stats.keptLate}` : undefined },
        { label: 'تحقق جزئياً', value: stats.partiallyFulfilled },
        { label: 'لم يتحقق', value: stats.broken, tone: 'text-destructive' },
        { label: 'متأخر', value: stats.overdue, tone: 'text-destructive' },
        { label: 'لم يُحسم بعد', value: stats.open },
        { label: 'أُجّل أو سُحب', value: stats.postponed + stats.retracted },
    ];

    return (
        <Card>
            <CardContent className="grid grid-cols-2 gap-y-5 p-5 sm:grid-cols-4 lg:grid-cols-7">
                <div className="col-span-2 flex flex-col items-center justify-center text-center sm:col-span-4 lg:col-span-1 lg:border-e lg:border-border">
                    <span className="text-4xl font-black tabular-nums text-foreground">{stats.total}</span>
                    <span className="mt-1 text-xs font-medium text-muted-foreground">إجمالي الوعود</span>
                </div>
                {items.map((item) => (
                    <div key={item.label} className="flex flex-col items-center text-center">
                        <span className={cn('text-3xl font-black tabular-nums', item.tone ?? 'text-foreground')}>{item.value}</span>
                        <span className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</span>
                        {item.note && <span className="text-[11px] text-muted-foreground">{item.note}</span>}
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
