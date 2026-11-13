import { LayoutGrid, Table as TableIcon } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { cn } from '@/Lib/utils';

export type DirectoryView = 'grid' | 'table';

interface Props {
    value: DirectoryView;
    onChange: (value: DirectoryView) => void;
    className?: string;
}

/**
 * Two real toggle buttons for the grid/table pair every directory offers. They
 * carry the same accessible names on every page, so a screen-reader user hears
 * one control, not six variants of it.
 */
export default function DirectoryViewToggle({ value, onChange, className }: Props) {
    return (
        <div role="group" aria-label="طريقة العرض" className={cn('flex items-center gap-1 rounded-lg border border-border bg-card p-1', className)}>
            <Button
                type="button"
                aria-label="عرض كجدول"
                title="عرض كجدول"
                aria-pressed={value === 'table'}
                variant={value === 'table' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange('table')}
            >
                <TableIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
                type="button"
                aria-label="عرض كبطاقات"
                title="عرض كبطاقات"
                aria-pressed={value === 'grid'}
                variant={value === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={() => onChange('grid')}
            >
                <LayoutGrid className="h-4 w-4" aria-hidden="true" />
            </Button>
        </div>
    );
}
