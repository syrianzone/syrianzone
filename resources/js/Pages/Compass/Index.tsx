import React from 'react';
import { Head, usePage } from '@inertiajs/react';
import CompassApp from './CompassApp';
import MainLayout from '@/Layouts/MainLayout';

export default function CompassPage() {
    const user = (usePage().props.auth as { user?: { id: number } } | undefined)?.user ?? null;

    return (
        <MainLayout>
            <Head>
                <title>بوصلة سوريا | Syrian Zone</title>
                <meta
                    name="description"
                    content="بوصلة سوريا — اختبار تفاعلي لاكتشاف موقعك السياسي على أحد عشر محوراً وأقرب التوجّهات والشخصيات إليك."
                />
                <meta property="og:type" content="website" />
                <meta property="og:title" content="بوصلة سوريا | Syrian Zone" />
                <meta
                    property="og:description"
                    content="اكتشف موقعك السياسي وأقرب الشخصيات إليك على بوصلة سوريا."
                />
            </Head>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
                <section className="bg-card py-9 border-b border-border">
                    <div className="container mx-auto px-4 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">بوصلة سوريا</h1>
                        <p className="text-base md:text-lg text-muted-foreground">
                            اكتشف موقعك السياسي على أحد عشر محوراً وأقرب التوجّهات إليك
                        </p>
                    </div>
                </section>

                <main className="flex-1 container mx-auto px-3 sm:px-4 py-6 relative z-10 max-w-3xl">
                    <CompassApp isLoggedIn={Boolean(user)} />
                </main>
            </div>
        </MainLayout>
    );
}
