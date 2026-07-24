"use client";
import React from 'react';
import { GovApp } from './types';
import { Card, CardContent } from "@/components/ui/card";
import { Smartphone, Globe, Pencil, Settings } from "lucide-react";
import { usePage } from '@inertiajs/react';

function AndroidIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className={className} fill="currentColor">
            <path d="M32 25.333H0a18.1 18.1 0 0 1 2.948-8.094a14.95 14.95 0 0 1 4.88-4.708l.547-.302l-2.693-4.547a.683.683 0 0 1 .224-.938a.673.673 0 0 1 .922.24l2.771 4.667a16.9 16.9 0 0 1 6.453-1.198c2.172-.026 4.323.38 6.333 1.198l2.76-4.667a.67.67 0 0 1 .932-.224a.676.676 0 0 1 .214.932l-2.693 4.562l.667.37a15.2 15.2 0 0 1 4.839 4.828A19.3 19.3 0 0 1 32 25.332zm-10-5.974a1.332 1.332 0 1 0 2.664.002A1.332 1.332 0 0 0 22 19.36m-14.667 0a1.332 1.332 0 1 0 2.664.002a1.332 1.332 0 0 0-2.664-.002"/>
        </svg>
    );
}

function IosIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor">
            <path d="M19.665 16.811a10.3 10.3 0 0 1-1.021 1.837q-.807 1.15-1.316 1.592q-.787.723-1.692.744q-.649.001-1.562-.373q-.914-.372-1.683-.371q-.805-.001-1.73.371q-.924.375-1.495.393q-.866.038-1.729-.764q-.55-.48-1.377-1.648q-.885-1.245-1.455-2.891q-.61-1.78-.611-3.447q0-1.91.826-3.292a4.86 4.86 0 0 1 1.73-1.751a4.65 4.65 0 0 1 2.34-.662q.69.001 1.81.422c1.12.421 1.227.422 1.436.422q.237 0 1.593-.498q1.279-.46 2.163-.384q2.4.192 3.6 1.895q-2.145 1.301-2.123 3.637q.02 1.82 1.317 3.023a4.3 4.3 0 0 0 1.315.863q-.159.46-.336.882M15.998 2.38q-.001 1.426-1.039 2.659c-.836.976-1.846 1.541-2.941 1.452a3 3 0 0 1-.021-.36c0-.913.396-1.889 1.103-2.688q.528-.606 1.343-1.009q.813-.397 1.536-.435q.02.192.019.381"/>
        </svg>
    );
}

interface GovAppsClientProps {
    initialData: GovApp[];
}

const DEFAULT_GOVAPP_ICON = 'https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/govapps/mofa/icon.webp';

function AppIcon({ app, className }: {
    app: GovApp;
    className?: string;
    placeholderClassName?: string;
}) {
    const iconUrl = app.icon || DEFAULT_GOVAPP_ICON;

    return (
        <img
            src={iconUrl}
            alt={app.name}
            loading="lazy"
            decoding="async"
            className={className}
            onError={(e) => {
                (e.target as HTMLImageElement).src = DEFAULT_GOVAPP_ICON;
            }}
        />
    );
}

function DescriptionText({ description }: { description: string }) {
    const [expanded, setExpanded] = React.useState(false);

    return (
        <p
            onClick={(e) => {
                e.stopPropagation();
                setExpanded((prev) => !prev);
            }}
            className={`text-xs text-muted-foreground leading-relaxed mb-3 cursor-pointer select-none transition-all ${
                expanded ? 'line-clamp-none font-medium text-foreground/90' : 'line-clamp-2 hover:text-foreground/80'
            }`}
            title={expanded ? 'اضغط للتقليص' : 'اضغط لإظهار النص كاملاً'}
        >
            {description}
        </p>
    );
}

export default function GovAppsClient({ initialData }: GovAppsClientProps) {
    const { auth } = usePage().props as any;
    const userRole = auth?.user?.role;
    const isSuperAdmin = userRole === 'superadmin' || userRole === 'admin' || userRole === 'govapps_admin';

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <section className="bg-card py-10 shadow-sm border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl">
                    {isSuperAdmin && (
                        <div className="mb-4 flex justify-center">
                            <a
                                href="/admin/govapps"
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg hover:bg-primary/90 transition-all transform hover:-translate-y-0.5"
                            >
                                <Settings className="w-4 h-4" />
                                <span>لوحة تحكم إدارة التطبيقات (Admin Panel)</span>
                            </a>
                        </div>
                    )}
                    <h1 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">تطبيقات حكومية</h1>
                    <p className="text-lg text-muted-foreground">
                        دليل التطبيقات والخدمات الحكومية الإلكترونية الرسمية
                    </p>
                </div>
            </section>

            <div className="container mx-auto px-4 py-8">
                {initialData.length === 0 ? (
                    <div className="text-center py-20 bg-muted/30 rounded-xl border border-dashed">
                        <Smartphone className="h-16 w-16 mx-auto text-muted-foreground/40 mb-4" />
                        <h3 className="text-xl font-medium text-foreground">لم يتم العثور على تطبيقات</h3>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3.5 sm:gap-4">
                        {initialData.map((app) => (
                            <Card
                                key={app.id}
                                className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/90 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                            >
                                <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
                                    {isSuperAdmin && (
                                        <a
                                            href={`/admin/govapps?edit=${app.id}`}
                                            className="absolute top-2 start-2 z-10 p-1.5 rounded-lg bg-background/90 hover:bg-primary hover:text-primary-foreground text-foreground backdrop-blur-md border border-border/70 shadow-md transition-all duration-200 opacity-90 hover:opacity-100 hover:scale-110 flex items-center gap-1 text-xs font-bold"
                                            title="تعديل التطبيق في لوحة التحكم"
                                        >
                                            <Pencil className="w-3.5 h-3.5" />
                                            <span className="hidden sm:inline">تعديل</span>
                                        </a>
                                    )}
                                    <AppIcon
                                        app={app}
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        placeholderClassName="h-10 w-10 text-muted-foreground/30"
                                    />
                                </div>

                                <CardContent className="p-3.5 text-center flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-sm sm:text-base text-foreground mb-1.5 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                                            {app.name}
                                        </h3>
                                        {app.description && (
                                            <DescriptionText description={app.description} />
                                        )}
                                    </div>

                                    {app.links && (app.links.android?.trim() || app.links.apple?.trim() || app.links.official?.trim()) ? (
                                        <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                            {app.links.android && app.links.android.trim() ? (
                                                <a
                                                    href={app.links.android}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-[#3DDC84] shadow-2xs"
                                                    title="تحميل لأندرويد"
                                                >
                                                    <AndroidIcon className="h-4 w-4" />
                                                </a>
                                            ) : null}
                                            {app.links.apple && app.links.apple.trim() ? (
                                                <a
                                                    href={app.links.apple}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-foreground shadow-2xs"
                                                    title="تحميل لآيفون"
                                                >
                                                    <IosIcon className="h-4 w-4" />
                                                </a>
                                            ) : null}
                                            {app.links.official && app.links.official.trim() ? (
                                                <a
                                                    href={app.links.official}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-all duration-200 hover:scale-105 hover:text-primary shadow-2xs"
                                                    title="الموقع الرسمي"
                                                >
                                                    <Globe className="h-4 w-4" />
                                                </a>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
