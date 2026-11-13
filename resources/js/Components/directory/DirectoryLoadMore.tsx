import { Button } from '@/Components/ui/button';
import { cn } from '@/Lib/utils';

interface Props {
    onClick: () => void;
    label?: string;
    className?: string;
}

/** Grow the visible slice by one page. Rendered only while `hasMore` is true. */
export default function DirectoryLoadMore({ onClick, label = 'تحميل المزيد', className }: Props) {
    return (
        <div className={cn('mt-12 flex justify-center pb-8', className)}>
            <Button
                type="button"
                onClick={onClick}
                size="lg"
                className="min-w-[200px] rounded-full bg-primary font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg"
            >
                {label}
            </Button>
        </div>
    );
}
