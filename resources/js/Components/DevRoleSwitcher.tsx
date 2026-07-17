'use client';

import * as React from 'react';
import { usePage, router } from '@inertiajs/react';
import { Shield, User, Bus, Settings2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROLE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    user:          { label: 'مستخدم (User)',          icon: User },
    transit_admin: { label: 'مشرف تنقل (Transit)',     icon: Bus },
    admin:         { label: 'مدير (Admin)',            icon: Settings2 },
    superadmin:    { label: 'مدير عام (Superadmin)',   icon: Shield },
};

export function DevRoleSwitcher() {
    const { props } = usePage<{ dev?: { enabled: boolean; roles: string[]; currentRole: string | null } }>();
    const dev = props.dev;
    const [open, setOpen] = React.useState(false);

    if (!dev?.enabled) return null;

    const current = dev.currentRole ?? 'superadmin';
    const CurrentIcon = ROLE_META[current]?.icon ?? Shield;

    const switchTo = (role: string) => {
        setOpen(false);
        if (role === current) return;
        router.visit(`/dev/impersonate/${role}`, { method: 'get' });
    };

    return (
        <div className="fixed bottom-4 start-4 z-[100] rtl:start-auto ltr:end-4">
            <div className="relative">
                <button
                    type="button"
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-lg transition-colors hover:bg-accent"
                    title="تبديل دور المستخدم (وضع التطوير)"
                >
                    <CurrentIcon className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline">{ROLE_META[current]?.label ?? current}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                </button>

                {open && (
                    <div className="absolute bottom-full mb-2 w-52 rounded-xl border border-border bg-card p-1.5 shadow-xl">
                        <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            وضع التطوير — تبديل الدور
                        </p>
                        {dev.roles.map((role: string) => {
                            const Meta = ROLE_META[role] ?? { label: role, icon: Shield };
                            const Icon = Meta.icon;
                            const isActive = role === current;
                            return (
                                <button
                                    key={role}
                                    type="button"
                                    onClick={() => switchTo(role)}
                                    className={cn(
                                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary/15 text-primary'
                                            : 'text-foreground hover:bg-accent'
                                    )}
                                >
                                    <Icon className="h-4 w-4" />
                                    <span className="flex-1 text-right">{Meta.label}</span>
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
