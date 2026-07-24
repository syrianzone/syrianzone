import React from 'react';
import MainLayout from '@/Layouts/MainLayout';
import SyidClient from './SyidClient';
import './page_custom.css';
import { Head } from '@inertiajs/react';

export default function SyidPage() {
    const jsonLdData = {
        "@context": "https://schema.org",
        "@type": "WebPage",
        "name": "الهوية البصرية السورية",
        "description": "عناصر الهوية البصرية السورية - دليل وموارد غير رسمية تشمل الألوان والخطوط وخريطة سوريا ونسب العلم السوري وتطبيقاته.",
        "inLanguage": "ar",
        "publisher": {
            "@type": "Organization",
            "name": "syrian.zone",
            "url": "https://syrian.zone"
        }
    };

    return (
        <MainLayout>
            <Head>
                <title>الهوية البصرية السورية | syrian.zone</title>
                <meta name="description" content="عناصر الهوية البصرية السورية - دليل وموارد غير رسمية تشمل الألوان والخطوط وخريطة سوريا ونسب العلم السوري وتطبيقاته." />
                <meta name="keywords" content="الهوية البصرية السورية, علم سوريا, خط قمرة, ألوان الهوية السورية, خريطة سوريا SVG, GeoJSON, سوريا" />
                <meta property="og:title" content="الهوية البصرية السورية | syrian.zone" />
                <meta property="og:description" content="عناصر الهوية البصرية السورية - دليل وموارد تشمل الألوان والخطوط وخريطة سوريا ونسب العلم السوري وتطبيقاته." />
                <meta property="og:type" content="website" />
                <meta property="og:image" content="/syid-assets/materials/qomra2.webp" />
                <meta name="twitter:card" content="summary_large_image" />
                <meta name="twitter:title" content="الهوية البصرية السورية | syrian.zone" />
                <meta name="twitter:description" content="عناصر الهوية البصرية السورية - دليل وموارد تشمل الألوان والخطوط وخريطة سوريا ونسب العلم السوري وتطبيقاته." />
                <meta name="twitter:image" content="/syid-assets/materials/qomra2.webp" />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdData) }}
                />
            </Head>
            <SyidClient />
        </MainLayout>
    );
}
