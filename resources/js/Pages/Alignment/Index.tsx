import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import CompassClient from './CompassClient';
import { Head } from '@inertiajs/react';

export default function AlignmentPage() {
    return (
        <MainLayout>
            <Head>
                <title>مواءمة البوصلة السياسية | Syrian Zone</title>
                <meta name="description" content="أداة مواءمة البوصلة السياسية السورية - قارن توجهاتك وميولك مع المكونات والقوى السياسية المختلفة." />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="مواءمة البوصلة السياسية | Syrian Zone" />
                <meta property="og:description" content="أداة مواءمة البوصلة السياسية السورية - قارن توجهاتك وميولك مع المكونات والقوى السياسية المختلفة." />
            </Head>
            <CompassClient />
        </MainLayout>
    );
}
