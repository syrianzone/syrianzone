import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import { BarChart3, PencilRuler } from 'lucide-react';
import CompassApp from './CompassApp';
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';
import { Button } from '@/Components/ui/button';
import type { Figure, Spectrum } from '@/Domain/compass/types';

export default function CompassPage() {
    const props = usePage().props as { auth?: { user?: { id: number } }; figures?: Figure[]; personas?: Spectrum[] };
    const user = props.auth?.user ?? null;
    const figures = props.figures ?? [];
    const personas = props.personas ?? [];

    return (
        <MainLayout>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
                <PageBody className="pb-2">
                    <PageHeader
                        title="بوصلة سوريا"
                        description="اكتشف موقعك السياسي على أحد عشر محوراً وأقرب التوجّهات إليك."
                        divider
                        actions={
                            <div className="flex flex-wrap items-center gap-2">
                                <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                                    <Link href="/compass/stats">
                                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                                        <span>إحصاءات عامة</span>
                                    </Link>
                                </Button>
                                {/* The only in-site link to /alignment: without it the
                                    page is reachable from the sitemap alone. */}
                                <Button asChild variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground">
                                    <Link href="/alignment">
                                        <PencilRuler className="h-4 w-4" aria-hidden="true" />
                                        <span>صمّم بوصلتك</span>
                                    </Link>
                                </Button>
                            </div>
                        }
                    />
                </PageBody>

                <div className="flex-1 container mx-auto px-3 sm:px-4 py-4 relative z-10 max-w-3xl">
                    <CompassApp isLoggedIn={Boolean(user)} figures={figures} personas={personas} />
                </div>
            </div>
        </MainLayout>
    );
}
