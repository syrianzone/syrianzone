import type { ReactNode } from 'react';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';

export type StatusTone = 'done' | 'progress' | 'warning' | 'late' | 'pending';

const TONE_MAP: Record<StatusTone, { variant: 'success' | 'info' | 'warning' | 'destructive' | 'secondary'; dot: string }> = {
    done: { variant: 'success', dot: 'bg-success-foreground' },
    progress: { variant: 'info', dot: 'bg-info-foreground' },
    warning: { variant: 'warning', dot: 'bg-warning-foreground' },
    late: { variant: 'destructive', dot: 'bg-destructive-foreground' },
    pending: { variant: 'secondary', dot: 'bg-muted-foreground' },
};

/**
 * Semantic status badge for trackers (promises, crossings, drafts).
 * Always shows its label text alongside a subtle rounded-square indicator.
 */
export function StatusBadge({
    tone,
    children,
    className,
}: {
    tone: StatusTone;
    children: ReactNode;
    className?: string;
}) {
    const config = TONE_MAP[tone];
    return (
        <Badge variant={config.variant} className={cn('gap-1.5 font-semibold', className)}>
            <span aria-hidden="true" className={cn('size-1.5 rounded-[2px]', config.dot)} />
            {children}
        </Badge>
    );
}
