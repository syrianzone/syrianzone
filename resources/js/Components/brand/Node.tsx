import { cn } from '@/Lib/utils';

type NodeSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<NodeSize, string> = {
    xs: 'size-1.5 rounded-[2px]',
    sm: 'size-2 rounded-[2.5px]',
    md: 'size-2.5 rounded-[3px]',
    lg: 'size-3 rounded-[3.5px]',
};

/**
 * The saffron rounded-square node from the «المدار» mark (corner ratio 0.284).
 * Used as the standard section marker, list bullet, and active indicator.
 */
export function Node({ size = 'sm', className }: { size?: NodeSize; className?: string }) {
    return (
        <span
            aria-hidden="true"
            className={cn('inline-block shrink-0 bg-sz-node', SIZE_CLASSES[size], className)}
        />
    );
}
