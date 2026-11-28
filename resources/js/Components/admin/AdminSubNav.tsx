import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    CloudUpload,
    Inbox,
    KeyRound,
    LayoutDashboard,
    LayoutGrid,
    Megaphone,
    User,
    Users,
} from 'lucide-react';
import {
    CompassIcon,
    CrossingsIcon,
    GovAppsIcon,
    GovtCvsIcon,
    GuessWhoIcon,
    HouseIcon,
    MishwarIcon,
    PhonebookIcon,
    PromisesIcon,
    SitesIcon,
    SyOfficialIcon,
    TierlistIcon,
    TransitIcon,
} from '@/Components/Icons/ProjectIcons';
import { Badge } from '@/Components/ui/badge';
import {
    ADMIN_SECTIONS,
    adminSectionAllowed,
    type AdminSection,
    type AdminSectionGroup,
} from '@/Lib/siteModules';
import { useCan, useCanModule } from '@/Lib/useCan';
import { cn } from '@/Lib/utils';
import type { AuthProps } from '@/types/auth';

export const ADMIN_GROUP_ORDER: readonly AdminSectionGroup[] = [
    'moderation',
    'directories',
    'interactive',
    'system',
];

export const ADMIN_GROUP_LABELS: Record<AdminSectionGroup, string> = {
    moderation: 'الرقابة والمراجعة',
    directories: 'الأدلة والبيانات',
    interactive: 'التفاعل والأدوات',
    system: 'النظام والصلاحيات',
};

export const ADMIN_SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    suggestions: Inbox,
    places: MishwarIcon,
    transit: TransitIcon,
    promises: PromisesIcon,
    govtcvs: GovtCvsIcon,
    syofficial: SyOfficialIcon,
    govapps: GovAppsIcon,
    phonebook: PhonebookIcon,
    crossings: CrossingsIcon,
    sites: SitesIcon,
    house: HouseIcon,
    polls: TierlistIcon,
    compass: CompassIcon,
    guesswho: GuessWhoIcon,
    users: Users,
    site_navigation: LayoutGrid,
    site_popup: Megaphone,
    assets: CloudUpload,
    api_tokens: KeyRound,
};

export interface AdminSubNavProps {
    activeSection?: string;
    pendingCounts?: Record<string, number>;
    onNavigate?: () => void;
}

function navItemClass(active: boolean): string {
    return cn(
        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
    );
}

export function AdminSubNav({ activeSection, pendingCounts, onNavigate }: AdminSubNavProps) {
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

    const ungrouped = allowedSections.filter((section) => !section.group);

    return (
        <nav aria-label="أقسام لوحة الإدارة" className="space-y-5">
            <div className="space-y-1 border-b border-border pb-3">
                <Link
                    href="/dashboard"
                    onClick={onNavigate}
                    className={navItemClass(false)}
                >
                    <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">حسابي</span>
                </Link>
                <Link
                    href="/admin"
                    onClick={onNavigate}
                    aria-current={activeSection === 'overview' ? 'page' : undefined}
                    className={navItemClass(activeSection === 'overview')}
                >
                    <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">نظرة عامة</span>
                </Link>
            </div>

            {grouped.map((group) => (
                <div key={group.id} className="space-y-1">
                    <p className="px-3 text-[11px] font-semibold tracking-wide text-muted-foreground/80">
                        {group.label}
                    </p>
                    <ul className="space-y-0.5">
                        {group.sections.map((section) => (
                            <AdminSubNavItem
                                key={section.id}
                                section={section}
                                active={activeSection === section.id}
                                pendingCount={pendingCounts?.[section.id] ?? 0}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </ul>
                </div>
            ))}

            {ungrouped.length > 0 && (
                <ul className="space-y-0.5 border-t border-border pt-3">
                    {ungrouped.map((section) => (
                        <AdminSubNavItem
                            key={section.id}
                            section={section}
                            active={activeSection === section.id}
                            pendingCount={pendingCounts?.[section.id] ?? 0}
                            onNavigate={onNavigate}
                        />
                    ))}
                </ul>
            )}
        </nav>
    );
}

function AdminSubNavItem({
    section,
    active,
    pendingCount,
    onNavigate,
}: {
    section: AdminSection;
    active: boolean;
    pendingCount: number;
    onNavigate?: () => void;
}) {
    const Icon = ADMIN_SECTION_ICONS[section.id] ?? LayoutGrid;

    return (
        <li>
            <Link
                href={section.href}
                onClick={onNavigate}
                aria-current={active ? 'page' : undefined}
                className={navItemClass(active)}
            >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{section.label}</span>
                {pendingCount > 0 && (
                    <Badge
                        variant={active ? 'default' : 'secondary'}
                        className="ms-auto h-5 min-w-5 justify-center px-1.5 text-[11px] tabular-nums"
                    >
                        {pendingCount}
                    </Badge>
                )}
            </Link>
        </li>
    );
}

export default AdminSubNav;
