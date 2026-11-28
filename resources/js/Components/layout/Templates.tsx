import type { ReactNode } from 'react';
import { cn } from '@/Lib/utils';
import { PageShell } from './PageShell';

/**
 * «القراءة»: 48rem reading column with an optional sticky TOC beside it (above on mobile).
 * Renders inside MainLayout's single <main> landmark.
 */
export function ReaderLayout({
    children,
    toc,
    className,
}: {
    children: ReactNode;
    toc?: ReactNode;
    className?: string;
}) {
    return (
        <PageShell
            width={toc ? 'default' : 'narrow'}
            className={cn(
                'pb-14 pt-8',
                toc && 'grid justify-center gap-10 lg:grid-cols-[minmax(0,48rem)_15rem]',
                className,
            )}
        >
            <article className="min-w-0 space-y-6">{children}</article>
            {toc && (
                <aside className="max-lg:order-first lg:sticky lg:top-20 lg:self-start">
                    {toc}
                </aside>
            )}
        </PageShell>
    );
}

/**
 * «التجربة»: narrow step-by-step flow shell with progress bar, step card, and navigation.
 */
export function FlowLayout({
    title,
    step,
    total,
    children,
    nav,
    result,
    className,
}: {
    title: ReactNode;
    step?: number;
    total?: number;
    children?: ReactNode;
    nav?: ReactNode;
    result?: ReactNode;
    className?: string;
}) {
    const pct = step && total ? Math.round((step / total) * 100) : undefined;
    const ar = (n: number) => n.toLocaleString('ar-SY');
    return (
        <PageShell width="narrow" className={cn('pb-14 pt-6 md:pt-10', className)}>
            <div className="flex items-center justify-between">
                <span className="font-display text-lg font-extrabold text-foreground">{title}</span>
                {step && total && (
                    <span className="text-sm text-muted-foreground">
                        {ar(step)} من {ar(total)}
                    </span>
                )}
            </div>
            {pct !== undefined && (
                <div
                    className="mb-6 mt-3 h-2 overflow-hidden rounded-full bg-secondary"
                    role="progressbar"
                    aria-valuenow={step}
                    aria-valuemin={0}
                    aria-valuemax={total}
                >
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                </div>
            )}
            {result ?? (
                <>
                    <div className="rounded-[calc(var(--radius)+4px)] border border-border bg-card p-5 md:p-8">
                        {children}
                    </div>
                    {nav && <div className="mt-4 flex items-center justify-between">{nav}</div>}
                </>
            )}
        </PageShell>
    );
}
