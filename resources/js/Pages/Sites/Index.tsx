import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import SitesClient from './SitesClient';
import { Website } from './types';

interface SitesPageProps {
    initialWebsites: Website[];
}

export default function SitesPage({ initialWebsites }: SitesPageProps) {
    return (
        <MainLayout>
            <SitesClient initialWebsites={initialWebsites} />
        </MainLayout>
    );
}
