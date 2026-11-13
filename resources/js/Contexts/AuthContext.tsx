import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { api } from '@/Lib/api';
import { hasCapability, type Capability } from '@/Lib/capabilities';
import type { AuthProps, AuthUser } from '@/types/auth';

interface AuthContextType {
    user: AuthUser | null;
    loading: boolean;
    isSuperAdmin: boolean;
    /** Reads the server-resolved capability list. */
    can: (permission: Capability) => boolean;
    /** Capability + governorate scope (transit.* only), from the server's resolved scope. */
    canInCity: (permission: Capability, cityId?: string | null) => boolean;
    /** Allowed transit governorates, or null when unrestricted (resolved server-side). */
    allowedTransitCities: () => string[] | null;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { props } = usePage<{ auth?: AuthProps }>();
    const sharedUser = props.auth?.user ?? null;

    const [user, setUser] = useState<AuthUser | null>(sharedUser);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setUser(sharedUser);
    }, [sharedUser]);

    const refreshUser = async () => {
        setLoading(true);
        try {
            const res = await api.get<AuthUser>('/user');
            setUser(res);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const isSuperAdmin = user?.role === 'superadmin';

    // Role implications are resolved on the server and arrive as
    // effective_permissions, so this delegates to the same function useCan()
    // uses. There is deliberately no role table in this module.
    const can = (permission: Capability): boolean =>
        hasCapability(user?.effective_permissions, permission);

    // The scope rule (superadmin bypass, stored scopes trimmed and emptied) is
    // `User::allowedTransitCities()`, and it arrives resolved as `transit_scope`
    // on the auth payload. This module only compares against it.
    const allowedTransitCities = (): string[] | null => user?.transit_scope ?? null;

    const canInCity = (permission: Capability, cityId?: string | null): boolean => {
        if (!can(permission)) return false;
        // Only transit.* capabilities carry a governorate scope
        // (User::hasPermissionInCity()).
        if (!permission.startsWith('transit.')) return true;

        const allowed = allowedTransitCities();
        if (allowed === null) return true;

        return !!cityId && allowed.includes(cityId);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isSuperAdmin, can, canInCity, allowedTransitCities, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
