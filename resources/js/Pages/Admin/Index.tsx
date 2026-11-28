import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { ArrowUpLeft, Clock, LayoutGrid } from 'lucide-react';
import { AdminLayout } from '@/Components/admin/AdminLayout';
import {
    ADMIN_GROUP_LABELS,
    ADMIN_GROUP_ORDER,
    ADMIN_SECTION_ICONS,
} from '@/Components/admin/AdminSubNav';
import { CardGrid } from '@/Components/layout';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import { ADMIN_SECTIONS, adminSectionAllowed } from '@/Lib/siteModules';
import { useCan, useCanModule } from '@/Lib/useCan';
import type { AuthProps } from '@/types/auth';

interface AdminOverviewStats {
    users: number;
    polls: number;
    crossings: number;
    sites: number;
    house: number;
}

interface AdminIndexProps {
    pendingCounts?: Record<string, number>;
    stats?: AdminOverviewStats | null;
}

const STAT_CARDS: Array<{
    key: keyof AdminOverviewStats;
    label: string;
    href: string;
}> = [
    { key: 'users', label: 'المستخدمون', href: '/admin/users' },
    { key: 'polls', label: 'الاستبيانات', href: '/admin/polls' },
    { key: 'crossings', label: 'المنافذ الحدودية', href: '/admin/crossings' },
    { key: 'sites', label: 'دليل المواقع', href: '/admin/sites' },
    { key: 'house', label: 'مجلس الشعب 2026', href: '/admin/house' },
];

export default function AdminIndex({ pendingCounts = {}, stats = null }: AdminIndexProps) {
    const can = useCan();
    const canModule = useCanModule();
    const user = usePage<{ auth?: AuthProps }>().props.auth?.user;
    const isSuperAdmin = user?.role === 'superadmin';

    const allowedSections = ADMIN_SECTIONS.filter((section) =>
        adminSectionAllowed(section, can, canModule, isSuperAdmin),
    );

    const grouped = ADMIN_GROUP_ORDER.map((groupId) => ({
        id: groupId,
        label: ADMIN_GROUP_LABELS[groupId],
        sections: allowedSections.filter((section) => section.group === groupId),
    })).filter((group) => group.sections.length > 0);

    const pendingSections = allowedSections.filter(
        (section) => (pendingCounts[section.id] ?? 0) > 0,
    );

    return (
        <AdminLayout
            title="لوحة الإدارة"
            subtitle="الوصول السريع إلى أقسام الإدارة والمراجعات المتاحة لحسابك."
            activeSection="overview"
            pendingCounts={pendingCounts}
        >
            {stats && (
                <section aria-labelledby="admin-stats-heading" className="space-y-3">
                    <h2 id="admin-stats-heading" className="text-sm font-semibold text-muted-foreground">
                        ملخص المنصة
                    </h2>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {STAT_CARDS.map((item) => (
                            <Link
                                key={item.key}
                                href={item.href}
                                className="group rounded-[calc(var(--radius)+4px)] border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <span className="text-xs text-muted-foreground group-hover:text-foreground">
                                    {item.label}
                                </span>
                                <div className="mt-2 font-display text-2xl font-extrabold leading-none text-foreground tabular-nums">
                                    {stats[item.key].toLocaleString('ar-SY-u-nu-latn')}
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {pendingSections.length > 0 && (
                <section aria-labelledby="admin-pending-heading" className="space-y-3">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
                        <h2 id="admin-pending-heading" className="text-sm font-semibold text-foreground">
                            بانتظار المراجعة
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {pendingSections.map((section) => {
                            const Icon = ADMIN_SECTION_ICONS[section.id] ?? LayoutGrid;
                            const count = pendingCounts[section.id] ?? 0;
                            return (
                                <Link
                                    key={section.id}
                                    href={section.href}
                                    className="group flex items-center justify-between gap-3 rounded-[calc(var(--radius)+4px)] border border-primary/25 bg-primary/5 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <div className="flex min-w-0 items-center gap-2.5">
                                        <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                        <span className="truncate text-sm font-semibold text-foreground">
                                            {section.label}
                                        </span>
                                    </div>
                                    <Badge className="shrink-0 tabular-nums">
                                        {count}
                                    </Badge>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            )}

            <div className="space-y-6">
                {grouped.map((group) => (
                    <section
                        key={group.id}
                        aria-labelledby={`admin-group-${group.id}`}
                        className="space-y-3"
                    >
                        <h2
                            id={`admin-group-${group.id}`}
                            className="text-sm font-semibold text-muted-foreground"
                        >
                            {group.label}
                        </h2>
                        <CardGrid columns={3}>
                            {group.sections.map((section) => {
                                const Icon = ADMIN_SECTION_ICONS[section.id] ?? LayoutGrid;
                                const count = pendingCounts[section.id] ?? 0;

                                return (
                                    <Link
                                        key={section.id}
                                        href={section.href}
                                        className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[calc(var(--radius)+4px)]"
                                    >
                                        <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/20">
                                            <CardContent className="flex items-center justify-between gap-3 p-4">
                                                <div className="flex min-w-0 items-center gap-3">
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                                                        <Icon className="h-4 w-4" aria-hidden="true" />
                                                    </div>
                                                    <span className="truncate text-sm font-semibold text-foreground">
                                                        {section.label}
                                                    </span>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    {count > 0 && (
                                                        <Badge variant="secondary" className="tabular-nums">
                                                            {count}
                                                        </Badge>
                                                    )}
                                                    <ArrowUpLeft
                                                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                );
                            })}
                        </CardGrid>
                    </section>
                ))}
            </div>
        </AdminLayout>
    );
}
