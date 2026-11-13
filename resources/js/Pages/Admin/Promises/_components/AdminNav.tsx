import { Link } from '@inertiajs/react';
import { Badge } from '@/Components/ui/badge';
import { cn } from '@/Lib/utils';
import { useCan } from '@/Lib/useCan';
import { SECTIONS, SECTION_KEYS, type SectionKey } from '../_lib/sections';

/**
 * Section links for the promises admin. Each entry's page path and the
 * capability its route requires are one record (`_lib/sections.ts`, from
 * `resources/data/promises-admin-sections.json`), so the link and its guard
 * cannot disagree.
 */
const LABELS: Record<SectionKey, string> = {
    promises: 'الوعود',
    review: 'المراجعة',
    speakers: 'أصحاب التصريحات',
    sectors: 'القطاعات',
};

export default function AdminNav({ current, queueCount }: {
    current: SectionKey;
    queueCount: number;
}) {
    const can = useCan();

    const items = SECTION_KEYS.map((key) => ({
        key,
        href: SECTIONS[key].page,
        label: LABELS[key],
        count: key === 'review' ? queueCount : 0,
        show: SECTIONS[key].capability === 'any' || can(SECTIONS[key].capability),
    }));

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
