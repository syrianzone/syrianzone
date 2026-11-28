import type { Key, ReactNode } from 'react';
import {
    Table,
    TableBody,
    TableHeader,
} from '@/Components/ui/table';
import { cn } from '@/Lib/utils';

export interface ResponsiveTableProps<T> {
    items: readonly T[];
    getKey: (item: T) => Key;
    /** Accessible label for the mobile <ul> list. */
    mobileLabel: string;
    /** The <TableRow> containing <TableHead> cells for the md+ desktop table. */
    desktopHeader: ReactNode;
    /** Renders a <TableRow> for each item on md+ viewports. */
    renderDesktopRow: (item: T) => ReactNode;
    /** Renders the 2-row compact content inside each mobile <li>. */
    renderMobileItem: (item: T) => ReactNode;
    /** Optional classes on the outer frame. */
    className?: string;
    /** Optional classes on <TableHeader>. */
    headerClassName?: string;
    /** Optional classes on each mobile <li>. */
    mobileItemClassName?: string;
}

/**
 * Shared responsive data table primitive:
 * - On mobile (< md): renders a borderless 2-row-per-item <ul> with 1px dividers
 *   so every row fits cleanly inside 390px without horizontal clipping.
 * - On desktop (md+): renders the standard shadcn <Table>.
 */
export function ResponsiveTable<T>({
    items,
    getKey,
    mobileLabel,
    desktopHeader,
    renderDesktopRow,
    renderMobileItem,
    className,
    headerClassName = 'bg-muted/60',
    mobileItemClassName,
}: ResponsiveTableProps<T>) {
    return (
        <div className={cn('bg-card rounded-lg border border-border overflow-hidden', className)}>
            <ul className="md:hidden divide-y divide-border" aria-label={mobileLabel}>
                {items.map((item) => (
                    <li key={getKey(item)} className={cn('px-3.5 py-3 space-y-2', mobileItemClassName)}>
                        {renderMobileItem(item)}
                    </li>
                ))}
            </ul>

            <div className="hidden md:block">
                <Table>
                    <TableHeader className={headerClassName}>
                        {desktopHeader}
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => renderDesktopRow(item))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
