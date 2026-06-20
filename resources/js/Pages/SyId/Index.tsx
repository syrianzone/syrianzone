import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import SyidClient from './SyidClient';
import './page_custom.css';
import { Head } from '@inertiajs/react';

export default function SyidPage() {
    return (
        <MainLayout>
            <Head>
                <title>الهوية البصرية السورية</title>
                <meta name="description" content="عناصر الهوية البصرية السورية - دليل وموارد غير رسمية تشمل الألوان والخطوط وخريطة سوريا ونسب العلم السوري وتطبيقاته." />
            </Head>
            <SyidClient />
        </MainLayout>
    );
}
