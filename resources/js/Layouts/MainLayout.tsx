import React from 'react';
import { AuthProvider } from '@/Contexts/AuthContext';
import ConditionalLayout from '@/Components/ConditionalLayout';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ConditionalLayout>
                {children}
            </ConditionalLayout>
        </AuthProvider>
    );
}
