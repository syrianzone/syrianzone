import type { LucideIcon } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { cn } from '@/Lib/utils';

interface Props {
    icon: LucideIcon;
    title: string;
    description?: string;
    /** Renders the "clear all filters" action; a page with no filters omits it. */
    onClear?: () => void;
    clearLabel?: string;
    className?: string;
}

/** The "nothing matches" card: one icon, an `<h2>` under the page `<h1>`, and an optional way out. */
export default function DirectoryEmptyState({
    icon: Icon, title, description, onClear, clearLabel = 'مسح جميع الفلاتر', className,
}: Props) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-20 text-center shadow-xs',
            className,
        )}>
            <Icon className="mb-4 h-16 w-16 text-muted-foreground/30" aria-hidden="true" />
            <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
            {onClear && (
                <Button type="button" variant="link" onClick={onClear} className="mt-2 text-primary">
                    {clearLabel}
                </Button>
            )}
        </div>
    );
}
