import { Link } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { PromisesIcon } from '@/Components/Icons/ProjectIcons';
import AdminNav from './AdminNav';

/** Title row + section links shared by every promises admin page. */
export default function AdminHeader({ title, current, queueCount, actions }: {
    title: string;
    current: 'promises' | 'review' | 'speakers' | 'sectors';
    queueCount: number;
    actions?: React.ReactNode;
}) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <PromisesIcon className="h-7 w-7" />
                    <h1 className="text-xl font-extrabold text-foreground">{title}</h1>
                    <Link href="/promises" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />الصفحة العامة
                    </Link>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            <AdminNav current={current} queueCount={queueCount} />
        </div>
    );
}
