import type { ReactNode } from 'react';
import { cn } from '@/Lib/utils';

/** Above any list or table: result count at the start; sort, view toggle, etc. at the end. */
export function PageToolbar({
    count,
    children,
    className,
}: {
    count?: ReactNode;
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3 text-sm', className)}>
            <div className="text-muted-foreground">{count}</div>
            {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
        </div>
    );
}

/**
 * Main column + aside.
 * - side="end" (default): 20rem column at the end side (left in RTL) for facts, related pages, charts.
 * - side="start": 15rem facets column at the start side.
 */
export function SplitLayout({
    children,
    aside,
    side = 'end',
    sticky = false,
    hideAsideOnMobile = false,
    className,
}: {
    children: ReactNode;
    aside: ReactNode;
    side?: 'start' | 'end';
    sticky?: boolean;
    hideAsideOnMobile?: boolean;
    className?: string;
}) {
    const asideEl = (
        <aside
            className={cn(
                'grid content-start gap-3.5',
                sticky && 'lg:sticky lg:top-20',
                hideAsideOnMobile && 'max-lg:hidden',
            )}
        >
            {aside}
        </aside>
    );

    return (
        <div
            className={cn(
                'grid items-start gap-7',
                side === 'end' ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : 'lg:grid-cols-[15rem_minmax(0,1fr)]',
                className,
            )}
        >
            {side === 'start' && asideEl}
            <div className="grid min-w-0 gap-4">{children}</div>
            {side === 'end' && asideEl}
        </div>
    );
}

/** Row of KPI stat cards: 4 on desktop, 2 on mobile. */
export function KpiGrid({
    items,
    className,
}: {
    items: { label: ReactNode; value: ReactNode; tone?: 'success' | 'info' | 'warning' | 'destructive' }[];
    className?: string;
}) {
    const toneClasses = {
        success: 'text-success',
        info: 'text-info',
        warning: 'text-warning',
        destructive: 'text-destructive',
    } as const;

    return (
        <div className={cn('mb-5 grid grid-cols-2 gap-3.5 lg:grid-cols-4', className)}>
            {items.map((k, i) => (
                <div key={i} className="rounded-[calc(var(--radius)+4px)] border border-border bg-card p-4">
                    <span className="text-[13px] text-muted-foreground">{k.label}</span>
                    <div
                        className={cn(
                            'mt-1.5 font-display text-[32px] font-extrabold leading-none text-foreground',
                            k.tone && toneClasses[k.tone],
                        )}
                    >
                        {k.value}
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Standard responsive card grid for collections and hubs. */
export function CardGrid({
    children,
    columns = 3,
    className,
}: {
    children: ReactNode;
    columns?: 2 | 3 | 4;
    className?: string;
}) {
    const colClass =
        columns === 4
            ? 'sm:grid-cols-2 lg:grid-cols-4'
            : columns === 2
              ? 'sm:grid-cols-2'
              : 'sm:grid-cols-2 lg:grid-cols-3';
    return <div className={cn('grid grid-cols-1 gap-3.5', colClass, className)}>{children}</div>;
}

/** Standard empty state: icon, one clear sentence, optional action. */
export function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'rounded-[calc(var(--radius)+4px)] border border-dashed border-border bg-card/40 px-5 py-12 text-center',
                className,
            )}
        >
            {icon && <div className="mx-auto mb-3 flex size-12 items-center justify-center text-muted-foreground">{icon}</div>}
            <p className="font-display text-lg font-extrabold text-foreground">{title}</p>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            {action && <div className="mt-4">{action}</div>}
        </div>
    );
}
