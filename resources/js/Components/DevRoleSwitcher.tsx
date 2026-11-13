import * as React from 'react';
import { usePage, router } from '@inertiajs/react';
import { Shield, User, Bus, Settings2, ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/Lib/utils';

// Preset identities, sent by AutoLoginDevUser as `dev.roles`; dev-only.
//
// These are not `users.role` values: each preset is a plain `user` account
// holding an explicit capability list, named after the module it previews —
// see AutoLoginDevUser.
const ROLE_ICONS: Record<string, LucideIcon> = {
    user: User,
    bus: Bus,
    settings: Settings2,
    shield: Shield,
};

export function DevRoleSwitcher() {
    const { props } = usePage();
    const dev = props.dev;
    const [open, setOpen] = React.useState(false);

    if (!dev?.enabled) return null;

    const roles = dev.roles;
    const current = dev.currentRole ?? 'superadmin';
    const currentRole = roles.find((role) => role.id === current);
    const CurrentIcon = ROLE_ICONS[currentRole?.icon ?? ''] ?? Shield;

    const switchTo = (role: string) => {
        setOpen(false);
        if (role === current) return;
        router.visit(`/dev/impersonate/${role}`, { method: 'get' });
    };

    return (
        <div role="region" aria-label="مبدّل الدور (تطوير)" className="fixed bottom-4 start-4 z-[60]">
            <div className="relative">
                <button aria-label="تبديل دور المستخدم (وضع التطوير)"
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-lg transition-colors hover:bg-accent"
                    title="تبديل دور المستخدم (وضع التطوير)"
                >
                    <CurrentIcon className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">{currentRole?.label ?? current}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                {open && (
                    <div className="absolute bottom-full mb-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            وضع التطوير — تبديل الدور
                        </p>
                        {roles.map((role) => {
                            const Icon = ROLE_ICONS[role.icon] ?? Shield;
                            const isActive = role.id === current;
                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => switchTo(role.id)}
                                    className={cn(
                                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-foreground hover:bg-accent'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="flex-1 text-right">{role.label}</span>
                                    {isActive && <span className="text-xs">✓</span>}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
