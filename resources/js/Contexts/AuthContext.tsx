import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    email: string;
    avatar_url: string;
    role: string;
    permissions?: string[];
    permission_scopes?: Record<string, string[]> | null;
    settings?: Record<string, unknown> | null;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    /** Mirrors User::hasPermission() role implications. */
    can: (permission: string) => boolean;
    /** Capability + governorate scope (transit.* only), mirrors hasPermissionInCity(). */
    canInCity: (permission: string, cityId?: string | null) => boolean;
    /** Allowed transit governorates, or null when unrestricted. */
    allowedTransitCities: () => string[] | null;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { props } = usePage();
    const sharedUser = (props.auth as any)?.user as User | null;

    const [user, setUser] = useState<User | null>(sharedUser);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setUser(sharedUser);
    }, [sharedUser]);

    const refreshUser = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/user');
            setUser(res.data);
        } catch (error) {
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
    const isSuperAdmin = user?.role === 'superadmin';

    const can = (permission: string): boolean => {
        if (!user) return false;
        if (user.role === 'superadmin') return true;
        if (user.role === 'syofficial_admin' && permission.startsWith('syofficial.')) return true;
        if (user.role === 'transit_admin' && permission.startsWith('transit.')) return true;
        if (user.role === 'govapps_admin' && permission.startsWith('govapps.')) return true;
        if (user.role === 'phonebook_admin' && permission.startsWith('phonebook.')) return true;

        const permissions = user.permissions ?? [];
        return permissions.includes(permission) || permissions.includes('*');
    };

    const allowedTransitCities = (): string[] | null => {
        if (!user || user.role === 'superadmin') return null;

        const scoped = user.permission_scopes?.transit;
        if (!Array.isArray(scoped)) return null;

        const cities = scoped.filter((city): city is string => typeof city === 'string' && city.length > 0);
        return cities.length > 0 ? cities : null;
    };

    const canInCity = (permission: string, cityId?: string | null): boolean => {
        if (!can(permission)) return false;
        if (!permission.startsWith('transit.')) return true;

        const allowed = allowedTransitCities();
        if (allowed === null) return true;

        return !!cityId && allowed.includes(cityId);
    };

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, isSuperAdmin, can, canInCity, allowedTransitCities, refreshUser }}>
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
