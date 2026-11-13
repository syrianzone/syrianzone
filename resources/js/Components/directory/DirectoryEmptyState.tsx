import type { LucideIcon } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { cn } from '@/Lib/utils';
import type { Directory } from './useDirectory';

interface Props {
    icon: LucideIcon;
    title: string;
    description?: string;
    /**
     * The page's `useDirectory` state. The card offers "clear all filters" by
     * itself whenever a query or a facet is active, so a page cannot forget it
     * and the reset stays the kit's to own. Omit it for a list that has no
     * filters at all.
     */
    directory?: Pick<Directory<unknown>, 'isFiltered' | 'clear'>;
    clearLabel?: string;
    className?: string;
}

/** The "nothing matches" card: one icon, an `<h2>` under the page `<h1>`, and a way out when there is one. */
export default function DirectoryEmptyState({
    icon: Icon, title, description, directory, clearLabel = 'مسح جميع الفلاتر', className,
}: Props) {
    return (
        <div className={cn(
            'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-20 text-center shadow-xs',
            className,
        )}>
            <Icon className="mb-4 h-16 w-16 text-muted-foreground/30" aria-hidden="true" />
            <h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
            {directory?.isFiltered && (
                <Button type="button" variant="link" onClick={directory.clear} className="mt-2 text-primary">
                    {clearLabel}
                </Button>
            )}
        </div>
    );
}
