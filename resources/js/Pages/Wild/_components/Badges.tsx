import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import {
    IUCN_LABELS,
    STATUS_LABELS,
    isThreatened,
    type IucnCategory,
    type SyriaStatus,
} from '@/Domain/wildlife/wildlife';

/** The global Red List category: solid for the three threatened ones, quieter below them. */
export function IucnBadge({ category, className }: { category: IucnCategory; className?: string }) {
    const variant = isThreatened(category) ? 'destructive' : category === 'NT' ? 'secondary' : 'outline';
    return (
        <Badge variant={variant} className={cn('gap-1.5 whitespace-nowrap', className)}>
            <span className="font-mono text-[10px] font-bold" dir="ltr" aria-hidden="true">
                {category}
            </span>
            <span>
                <span className="sr-only">التصنيف العالمي: </span>
                {IUCN_LABELS[category]}
            </span>
        </Badge>
    );
}

const GONE: SyriaStatus[] = ['possibly-extinct', 'extinct-in-syria'];

/** Where the species stands in Syria, which can differ sharply from its global category. */
export function StatusBadge({ status, className }: { status: SyriaStatus; className?: string }) {
    const gone = GONE.includes(status);
    return (
        <Badge
            variant="outline"
            className={cn(
                'whitespace-nowrap border-border font-medium',
                gone ? 'border-dashed text-muted-foreground' : 'text-foreground',
                className,
            )}
        >
            <span className="sr-only">في سوريا: </span>
            {STATUS_LABELS[status]}
        </Badge>
    );
}
