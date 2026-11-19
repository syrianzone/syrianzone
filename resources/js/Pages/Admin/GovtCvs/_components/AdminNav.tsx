import { Link } from '@inertiajs/react';
import { cn } from '@/Lib/utils';
import { useCan } from '@/Lib/useCan';

export type GovtCvsAdminSection = 'officials' | 'slots';

export default function AdminNav({ current }: { current: GovtCvsAdminSection }) {
    const can = useCan() as (cap: string) => boolean;

    const items: Array<{
        key: GovtCvsAdminSection;
        href: string;
        label: string;
        show: boolean;
    }> = [
        {
            key: 'officials',
            href: '/admin/govtcvs',
            label: 'المسؤولون',
            show: true,
        },
        {
            key: 'slots',
            href: '/admin/govtcvs/slots',
            label: 'المناصب والشواغر',
            show: can('govtcvs.slots') || can('govtcvs.edit') || can('govtcvs.create'),
        },
    ];

    return (
        <nav
            aria-label="أقسام إدارة السير الذاتية للمسؤولين"
            className="flex flex-wrap gap-1 rounded-lg bg-muted p-1"
        >
            {items
                .filter((i) => i.show)
                .map((i) => (
                    <Link
                        key={i.key}
                        href={i.href}
                        aria-current={current === i.key ? 'page' : undefined}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                            current === i.key
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {i.label}
                    </Link>
                ))}
        </nav>
    );
}
