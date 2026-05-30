import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import GovAppsClient from './GovAppsClient';
import { GovApp } from './types';

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
