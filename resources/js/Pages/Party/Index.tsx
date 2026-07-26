import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import PartyClient from './PartyClient';
import { Organization } from './types';
import { Head } from '@inertiajs/react';

interface PartyPageProps {
    initialOrganizations: Organization[];
}

export default function PartyPage({ initialOrganizations }: PartyPageProps) {
    return (
        <MainLayout>
            <Head>
                <title>دليل الأحزاب والقوى السياسية | Syrian Zone</title>
                <meta name="description" content="دليل تفاعلي للتعرف على الأحزاب، والتنظيمات، والقوى السياسية والمدنية الفاعلة في الساحة السورية." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="دليل الأحزاب والقوى السياسية | Syrian Zone" />
                <meta property="og:description" content="دليل تفاعلي للتعرف على الأحزاب، والتنظيمات، والقوى السياسية والمدنية الفاعلة في الساحة السورية." />
            </Head>
            <PartyClient initialOrganizations={initialOrganizations} />
        </MainLayout>
    );
}
