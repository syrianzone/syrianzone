import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { useCan } from '@/Lib/useCan';

/**
 * Section links for the promises admin. Each link appears only for staff who
 * hold the capability its page route requires (see routes/web.php).
 */
export default function AdminNav({ current, queueCount }: {
    current: 'promises' | 'review' | 'speakers' | 'sectors';
    queueCount: number;
}) {
    const can = useCan();

    const items = [
        { key: 'promises', href: '/admin/promises', label: 'الوعود', show: true, count: 0 },
        { key: 'review', href: '/admin/promises/review', label: 'المراجعة', show: can('promises.review'), count: queueCount },
        { key: 'speakers', href: '/admin/promises/speakers', label: 'أصحاب التصريحات', show: can('promises.speakers'), count: 0 },
        { key: 'sectors', href: '/admin/promises/sectors', label: 'القطاعات', show: can('promises.speakers'), count: 0 },
    ] as const;

    return (
        <nav aria-label="أقسام إدارة عداد الوعود" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {items.filter((i) => i.show).map((i) => (
                <Link
                    key={i.key}
                    href={i.href}
                    aria-current={current === i.key ? 'page' : undefined}
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                        current === i.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {i.label}
                    {i.count > 0 && (
                        <Badge variant="destructive" className="px-1.5 py-0 text-[10px] tabular-nums">
                            {i.count}
                            <span className="sr-only"> بانتظار المراجعة</span>
                        </Badge>
                    )}
                </Link>
            ))}
        </nav>
    );
}
