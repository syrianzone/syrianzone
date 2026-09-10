import React from 'react';
import { AuthProvider } from '@/Contexts/AuthContext';
import ConditionalLayout from '@/Components/ConditionalLayout';
import SettingsSync from '@/Pages/Muslim/_components/SettingsSync';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <ConditionalLayout>
                {children}
            </ConditionalLayout>
            <SettingsSync />
        </AuthProvider>
    );
}
