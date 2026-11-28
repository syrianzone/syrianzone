import { Link } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { cn } from '@/Lib/utils';
import { Node } from '@/Components/brand/Node';
import { PageShell, type ShellWidth } from './PageShell';

export type Crumb = { label: string; href?: string };

/**
 * Direct, anti-slop page header (shadcn + gemini-frontend-design):
 * - Opens straight into the Beiruti <h1> on the page ground (no banner box, no eyebrow, no decorative badges).
 * - Optional breadcrumbs for nested/detail pages only.
 * - Optional end-aligned action(s) and bottom hairline divider for document sheets.
 */
export function PageHeader({
    title,
    description,
    actions,
    breadcrumbs,
    divider = false,
    width = 'default',
    dir,
    className,
}: {
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
    breadcrumbs?: Crumb[];
    divider?: boolean;
    width?: ShellWidth;
    dir?: 'rtl' | 'ltr';
    className?: string;
}) {
    return (
        <header dir={dir} className={cn('bg-background', className)}>
            <PageShell
                width={width}
                className={cn(
                    'pt-6 md:pt-8',
                    divider ? 'border-b border-border pb-5 md:pb-6' : 'pb-4 md:pb-5',
                )}
            >
                {breadcrumbs && breadcrumbs.length > 0 && (
                    <nav aria-label="مسار التنقل" className="mb-2.5 text-[13px] text-muted-foreground">
                        <ol className="flex flex-wrap items-center gap-2">
                            {breadcrumbs.map((c, i) => (
                                <li key={i} className="flex items-center gap-2">
                                    {i > 0 && <Node size="xs" className="opacity-75" />}
                                    {c.href && i < breadcrumbs.length - 1 ? (
                                        <Link href={c.href} className="transition-colors hover:text-foreground">
                                            {c.label}
                                        </Link>
                                    ) : (
                                        <span
                                            aria-current={i === breadcrumbs.length - 1 ? 'page' : undefined}
                                            className={cn(i === breadcrumbs.length - 1 && 'font-medium text-foreground')}
                                        >
                                            {c.label}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </nav>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-foreground md:text-[34px]">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-muted-foreground md:text-[15px]">
                                {description}
                            </p>
                        )}
                    </div>

                    {actions && (
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {actions}
                        </div>
                    )}
                </div>
            </PageShell>
        </header>
    );
}
