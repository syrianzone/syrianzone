import React, { createContext, useContext, useEffect, useState } from 'react';
import { usePage } from '@inertiajs/react';
import axios from 'axios';

interface User {
    id: number;
    name: string;
    email: string;
    avatar_url: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
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

    const isAdmin = !!user;
    const isSuperAdmin = user?.role === 'superadmin';

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, isSuperAdmin, refreshUser }}>
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
