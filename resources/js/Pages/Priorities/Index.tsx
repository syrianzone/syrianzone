import React from 'react';
import PrioritiesApp from './PrioritiesApp';
import MainLayout from '@/Layouts/MainLayout';
import { PageBody, PageHeader } from '@/Components/layout';

export default function PrioritiesPage() {
    return (
        <MainLayout>
            <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors">
                <PageBody className="flex-1 space-y-6">
                    <PageHeader
                        title="أولويات سوريا المستقبل"
                        description="اصنع بطاقة تخبر الناس فيها عن أولوياتك لسوريا الحرة."
                        divider
                    />

                    <PrioritiesApp />
                </PageBody>
            </div>
        </MainLayout>
    );
}
