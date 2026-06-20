import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import CompassClient from './CompassClient';
import { Head } from '@inertiajs/react';

export default function AlignmentPage() {
    return (
        <MainLayout>
            <Head>
                <title>مواءمة البوصلة السياسية</title>
                <meta name="description" content="أداة مواءمة البوصلة السياسية السورية - قارن توجهاتك وميولك مع المكونات والقوى السياسية المختلفة." />
            </Head>
            <CompassClient />
        </MainLayout>
    );
}
