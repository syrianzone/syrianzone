import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import GovAppsClient from './GovAppsClient';
import type { GovApp } from '@/Domain/govapps/types';

interface GovAppsPageProps {
    initialData: GovApp[];
}

export default function GovAppsPage({ initialData }: GovAppsPageProps) {
    return (
        <MainLayout>
            
            <GovAppsClient initialData={initialData} />
        </MainLayout>
    );
}
