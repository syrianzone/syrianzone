import type { ReactNode } from 'react';
import { cn } from '@/Lib/utils';
import { Node } from './Node';

/**
 * Standard block heading: saffron Node + Beiruti display typography + optional trailing action.
 */
export function SectionHeading({
    children,
    as: Tag = 'h2',
    action,
    description,
    id,
    className,
}: {
    children: ReactNode;
    as?: 'h2' | 'h3';
    action?: ReactNode;
    description?: ReactNode;
    id?: string;
    className?: string;
}) {
    return (
        <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
            <div className="min-w-0">
                <Tag
                    id={id}
                    className={cn(
                        'flex items-center gap-2.5 font-display font-extrabold tracking-tight text-foreground',
                        Tag === 'h2' ? 'text-[22px] md:text-[24px]' : 'text-lg md:text-xl',
                    )}
                >
                    <Node size={Tag === 'h2' ? 'sm' : 'xs'} />
                    <span>{children}</span>
                </Tag>
                {description && (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
