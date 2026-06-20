import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import PopulationClient from './PopulationClient';
import { Head } from '@inertiajs/react';

interface PopulationPageProps {
    masterData?: any;
    envData?: any;
}

export default function PopulationPage({ masterData, envData }: PopulationPageProps) {
    return (
        <MainLayout>
            <Head>
                <title>أطلس سوريا التفاعلي</title>
                <meta name="description" content="أطلس سوريا التفاعلي - منصة لاستكشاف البيانات السكانية والجغرافية والإحصائية التفصيلية لمختلف المحافظات والمدن السورية." />
            </Head>
            <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-background">
                <PopulationClient masterData={masterData} envData={envData} />
            </div>
        </MainLayout>
    );
}