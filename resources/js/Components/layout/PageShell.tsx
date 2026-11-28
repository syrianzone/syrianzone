import type { ReactNode } from 'react';
import { cn } from '@/Lib/utils';

/**
 * The three canonical page widths:
 * - narrow (48rem): reader pages (about, privacy, terms, justice) and step flows
 * - default (76rem): directories, trackers, hubs, tools, detail pages
 * - full: full-bleed map applications
 */
export type ShellWidth = 'narrow' | 'default' | 'full';

const WIDTH: Record<ShellWidth, string> = {
    narrow: 'max-w-[48rem]',
    default: 'max-w-[76rem]',
    full: 'max-w-none',
};

/** Horizontal frame for a page or band: one of three widths, 16px mobile / 32px desktop padding. */
export function PageShell({
    width = 'default',
    className,
    children,
    as: Tag = 'div',
}: {
    width?: ShellWidth;
    className?: string;
    children: ReactNode;
    as?: 'div' | 'section';
}) {
    return (
        <Tag className={cn('mx-auto w-full', width !== 'full' && 'px-4 md:px-8', WIDTH[width], className)}>
            {children}
        </Tag>
    );
}

/**
 * Standard body container beneath PageHeader.
 * Uses a div (never a second <main>, since MainLayout owns the single <main> landmark).
 */
export function PageBody({
    width = 'default',
    className,
    children,
}: {
    width?: ShellWidth;
    className?: string;
    children: ReactNode;
}) {
    return (
        <PageShell width={width} className={cn('pb-14 pt-2', className)}>
            {children}
        </PageShell>
    );
}
