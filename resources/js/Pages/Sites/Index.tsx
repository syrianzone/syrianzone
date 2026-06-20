import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import SitesClient from './SitesClient';
import { Website } from './types';
import { Head } from '@inertiajs/react';

interface SitesPageProps {
    initialWebsites: Website[];
}

export default function SitesPage({ initialWebsites }: SitesPageProps) {
    return (
        <MainLayout>
            <Head>
                <title>دليل المواقع السورية</title>
                <meta name="description" content="دليل تفاعلي شامل للمواقع الإلكترونية والخدمات والمنصات السورية المفيدة بمختلف المجالات." />
            </Head>
            <SitesClient initialWebsites={initialWebsites} />
        </MainLayout>
    );
}
