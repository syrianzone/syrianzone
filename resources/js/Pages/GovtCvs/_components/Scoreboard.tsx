import type { ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { Card, CardContent } from '@/Components/ui/card';
import { cn } from '@/Lib/utils';
import type { GovtCvsStats } from '@/Domain/govtcvs/types';
import type { GovtScoreboardTile } from '../_lib/filters';

/**
 * Global totals, independent of the active list filters. Each status/CV tile is a
 * toggle that narrows the list to its officials; `active` is the tile criterion
 * the list shows exactly, if any. The total tile resets the list, and the movements
 * tile navigates to `/govtcvs/movements`.
 */
export default function Scoreboard({
    stats,
    active,
    onSelect,
}: {
    stats: GovtCvsStats;
    active: GovtScoreboardTile | null | undefined;
    onSelect: (tile: GovtScoreboardTile | null) => void;
}) {
    const items: Array<{
        key: GovtScoreboardTile;
        label: string;
        value: number;
        tone?: string;
        onClick?: () => void;
    }> = [
        {
            key: 'in_office',
            label: 'على رأس عمله',
            value: stats.in_office,
            tone: 'text-primary',
        },
        {
            key: 'out_of_office',
            label: 'خارج المنصب',
            value: stats.out_of_office,
        },
        {
            key: 'full_cv',
            label: 'سير ذاتية موثّقة',
            value: stats.full_cv,
            tone: 'text-primary',
        },
        {
            key: 'movements',
            label: 'التنقلات المرصودة',
            value: stats.total_movements,
            onClick: () => router.visit('/govtcvs/movements'),
        },
    ];

    return (
        <Card>
            <CardContent
                className="grid grid-cols-2 gap-y-3 p-3 sm:grid-cols-3 lg:grid-cols-5"
                role="group"
                aria-label="عرض المسؤولين حسب الحالة"
            >
                <div className="col-span-2 flex sm:col-span-3 lg:col-span-1 lg:border-e lg:border-border lg:pe-3">
                    <Tile onClick={() => onSelect(null)} className="flex-1 justify-center">
                        <span className="text-4xl font-black tabular-nums text-foreground">
                            {stats.total}
                        </span>
                        <span className="mt-1 text-xs font-medium text-muted-foreground">
                            إجمالي المسؤولين
                        </span>
                    </Tile>
                </div>
                {items.map((item) => (
                    <Tile
                        key={item.key}
                        pressed={item.onClick ? undefined : active === item.key}
                        onClick={item.onClick ?? (() => onSelect(item.key))}
                    >
                        <span
                            className={cn(
                                'text-3xl font-black tabular-nums',
                                item.tone ?? 'text-foreground',
                            )}
                        >
                            {item.value}
                        </span>
                        <span className="mt-1 text-xs font-medium text-muted-foreground">
                            {item.label}
                        </span>
                    </Tile>
                ))}
            </CardContent>
        </Card>
    );
}

/** A breakdown tile is a toggle (`pressed`); the total is a plain "show all" button. */
function Tile({
    pressed,
    onClick,
    className,
    children,
}: {
    pressed?: boolean;
    onClick: () => void;
    className?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(
                'flex cursor-pointer flex-col items-center rounded-lg p-2 text-center transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pressed && 'bg-foreground/10 hover:bg-foreground/10',
                className,
            )}
        >
            {children}
        </button>
    );
}
