import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { BarChart3 } from 'lucide-react';
import CompassApp from './CompassApp';
import MainLayout from '@/Layouts/MainLayout';
import type { Figure, Spectrum } from '@/Domain/compass/types';

export default function CompassPage() {
    const props = usePage().props as { auth?: { user?: { id: number } }; figures?: Figure[]; personas?: Spectrum[] };
    const user = props.auth?.user ?? null;
    const figures = props.figures ?? [];
    const personas = props.personas ?? [];

    return (
        <MainLayout>
            
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
                <section className="bg-card py-9 border-b border-border">
                    <div className="container mx-auto px-4 text-center">
                        <h1 className="text-3xl md:text-4xl font-bold mb-2 text-foreground">بوصلة سوريا</h1>
                        <p className="text-base md:text-lg text-muted-foreground">
                            اكتشف موقعك السياسي على أحد عشر محوراً وأقرب التوجّهات إليك
                        </p>
                        <div className="mt-3">
                            <Link
                                href="/compass/stats"
                                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                            >
                                <BarChart3 className="h-4 w-4" />
                                إحصاءات عامة مجهولة الهوية
                            </Link>
                        </div>
                    </div>
                </section>

                <div className="flex-1 container mx-auto px-3 sm:px-4 py-6 relative z-10 max-w-3xl">
                    <CompassApp isLoggedIn={Boolean(user)} figures={figures} personas={personas} />
                </div>
            </div>
        </MainLayout>
    );
}
