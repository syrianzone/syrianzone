import type { ReactNode } from 'react';
import { cn } from '@/Lib/utils';

/**
 * The result line above a directory list. It is a polite live region, so a
 * filter change is announced once instead of only moving pixels; each page
 * keeps its own wording.
 */
export default function DirectoryResultCount({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p role="status" aria-live="polite" aria-atomic="true" className={cn('text-sm font-medium text-muted-foreground', className)}>
            {children}
        </p>
    );
}
