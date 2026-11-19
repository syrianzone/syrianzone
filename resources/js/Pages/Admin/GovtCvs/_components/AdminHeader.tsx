import { Link } from '@inertiajs/react';
import { ExternalLink, IdCard } from 'lucide-react';
import AdminNav, { type GovtCvsAdminSection } from './AdminNav';

interface Props {
    title: string;
    current: GovtCvsAdminSection;
    actions?: React.ReactNode;
}

export default function AdminHeader({ title, current, actions }: Props) {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                    <span
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"
                        aria-hidden="true"
                    >
                        <IdCard className="h-5 w-5" />
                    </span>
                    <h1 className="text-xl font-extrabold text-foreground">{title}</h1>
                    <Link
                        href="/govtcvs"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        الصفحة العامة
                    </Link>
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
            <AdminNav current={current} />
        </div>
    );
}
