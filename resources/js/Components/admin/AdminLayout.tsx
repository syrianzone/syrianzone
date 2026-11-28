import React, { useState } from 'react';
import { ExternalLink, Menu } from 'lucide-react';
import MainLayout from '@/Layouts/MainLayout';
import { PageHeader, PageShell } from '@/Components/layout';
import { Button } from '@/Components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/Components/ui/sheet';
import { AdminSubNav } from './AdminSubNav';

export interface AdminLayoutProps {
    title: string;
    subtitle?: string;
    activeSection?: string;
    actions?: React.ReactNode;
    publicHref?: string;
    publicLabel?: string;
    pendingCounts?: Record<string, number>;
    children: React.ReactNode;
}

export function AdminLayout({
    title,
    subtitle,
    activeSection,
    actions,
    publicHref,
    publicLabel,
    pendingCounts,
    children,
}: AdminLayoutProps) {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const headerActions = (publicHref || actions) ? (
        <>
            {publicHref && (
                <Button asChild variant="outline" size="sm">
                    <a href={publicHref} target="_blank" rel="noreferrer">
                        <ExternalLink className="me-1.5 h-4 w-4" aria-hidden="true" />
                        {publicLabel ?? 'عرض الصفحة العامة'}
                    </a>
                </Button>
            )}
            {actions}
        </>
    ) : undefined;

    return (
        <MainLayout>
            <div dir="rtl" className="min-w-0">
                {/* Mobile navigation trigger bar */}
                <div className="border-b border-border bg-card/70 backdrop-blur-sm lg:hidden">
                    <PageShell width="default" className="flex items-center justify-between gap-2 py-2.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setDrawerOpen(true)}
                            aria-label="فتح قائمة أقسام الإدارة"
                        >
                            <Menu className="me-2 h-4 w-4" aria-hidden="true" />
                            أقسام الإدارة
                        </Button>
                        <span className="truncate text-xs font-medium text-muted-foreground">
                            لوحة الإدارة
                        </span>
                    </PageShell>
                </div>

                <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <SheetContent side="right" dir="rtl" className="w-72 overflow-y-auto p-4">
                        <SheetHeader className="mb-4 text-start">
                            <SheetTitle>لوحة الإدارة</SheetTitle>
                            <SheetDescription className="sr-only">
                                التنقل بين أقسام لوحة الإدارة
                            </SheetDescription>
                        </SheetHeader>
                        <AdminSubNav
                            activeSection={activeSection}
                            pendingCounts={pendingCounts}
                            onNavigate={() => setDrawerOpen(false)}
                        />
                    </SheetContent>
                </Sheet>

                <PageHeader
                    title={title}
                    description={subtitle}
                    actions={headerActions}
                    divider
                    width="default"
                />

                <PageShell width="default" className="pb-14 pt-6">
                    <div className="flex items-start gap-6 lg:gap-8">
                        <aside
                            aria-label="الشريط الجانبي للوحة الإدارة"
                            className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-60 shrink-0 overflow-y-auto rounded-[calc(var(--radius)+4px)] border border-border bg-card p-3 lg:block"
                        >
                            <AdminSubNav
                                activeSection={activeSection}
                                pendingCounts={pendingCounts}
                            />
                        </aside>

                        <div className="min-w-0 flex-1 space-y-6">
                            {children}
                        </div>
                    </div>
                </PageShell>
            </div>
        </MainLayout>
    );
}

export default AdminLayout;
