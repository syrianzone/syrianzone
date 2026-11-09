import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { STATE_META } from '../_lib/status';
import type { PromiseState } from '../_lib/types';

/** The promise's state as a badge with its icon. Never clickable. */
export default function StateBadge({ state, keptLate = false, className }: {
    state: PromiseState;
    keptLate?: boolean;
    className?: string;
}) {
    const meta = STATE_META[state];
    const Icon = meta.icon;

    return (
        <Badge variant={meta.variant} className={cn('gap-1 whitespace-nowrap', className)}>
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {meta.label}
            {keptLate && <span className="font-normal">(متأخراً)</span>}
        </Badge>
    );
}
