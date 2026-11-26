import { cn } from '@/Lib/utils';
import { STATUS_TEXT, type Status } from '@/Domain/crossings/crossings';

const STYLES: Record<Status, string> = {
    open: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    closed: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
    opening: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    pending: 'bg-muted text-muted-foreground border-border',
};

const DOTS: Record<Status, string> = {
    open: 'bg-emerald-500',
    closed: 'bg-red-500',
    opening: 'bg-amber-500',
    pending: 'bg-muted-foreground/40',
};

/** The colour alone carries no meaning for screen readers (or colour-blind
 *  users), so the dot speaks its status unless a visible label sits beside it. */
export function StatusDot({ status, className, decorative = false }: { status: Status; className?: string; decorative?: boolean }) {
    return (
        <>
            <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', DOTS[status], className)} />
            {!decorative && <span className="sr-only">{STATUS_TEXT[status]}، </span>}
        </>
    );
}

export function StatusPill({ status }: { status: Status }) {
    return (
        <span
            className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
                STYLES[status]
            )}
        >
            <StatusDot status={status} decorative />
            {STATUS_TEXT[status]}
        </span>
    );
}
