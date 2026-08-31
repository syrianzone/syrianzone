import { cn } from '@/lib/utils';
import { STATUS_TEXT, type Status } from '../_lib/crossings';

const STYLES: Record<Status, string> = {
    open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    closed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
    opening: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    pending: 'bg-muted text-muted-foreground border-border animate-pulse',
};

const DOTS: Record<Status, string> = {
    open: 'bg-emerald-500',
    closed: 'bg-red-500',
    opening: 'bg-amber-500',
    pending: 'bg-muted-foreground/40',
};

export function StatusDot({ status, className }: { status: Status; className?: string }) {
    return <span className={cn('h-2 w-2 shrink-0 rounded-full', DOTS[status], className)} />;
}

export function StatusPill({ status }: { status: Status }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
                STYLES[status]
            )}
        >
            <StatusDot status={status} />
            {STATUS_TEXT[status]}
        </span>
    );
}
