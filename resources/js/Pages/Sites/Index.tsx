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
                <title>دليل المواقع السورية | Syrian Zone</title>
                <meta name="description" content="دليل تفاعلي شامل للمواقع الإلكترونية والخدمات والمنصات السورية المفيدة بمختلف المجالات." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="دليل المواقع السورية | Syrian Zone" />
                <meta property="og:description" content="دليل تفاعلي شامل للمواقع الإلكترونية والخدمات والمنصات السورية المفيدة بمختلف المجالات." />
            </Head>
            <SitesClient initialWebsites={initialWebsites} />
        </MainLayout>
    );
}
