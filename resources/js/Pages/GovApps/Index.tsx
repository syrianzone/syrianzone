import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import GovAppsClient from './GovAppsClient';
import { GovApp } from './types';
import { Head } from '@inertiajs/react';

interface GovAppsPageProps {
    initialData: GovApp[];
}

export default function GovAppsPage({ initialData }: GovAppsPageProps) {
    return (
        <MainLayout>
            <Head>
                <title>دليل التطبيقات والخدمات الحكومية</title>
                <meta name="description" content="دليل تفاعلي لاستكشاف، ومتابعة، وتقييم التطبيقات والخدمات الإلكترونية الصادرة عن الجهات الحكومية السورية." />
            </Head>
            <GovAppsClient initialData={initialData} />
        </MainLayout>
    );
}
