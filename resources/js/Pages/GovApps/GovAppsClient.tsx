"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { GovApp } from './types';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from "@/components/ui/sheet";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ExternalLink, Smartphone, Images as ImageIcon, Globe, Pencil, Settings } from "lucide-react";
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

function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const media = window.matchMedia(query);
        if (media.matches !== matches) {
            setMatches(media.matches);
        }
        const listener = () => setMatches(media.matches);
        window.addEventListener('resize', listener);
        return () => window.removeEventListener('resize', listener);
    }, [matches, query]);
    return matches;
}

// ─── Browser Icon Cache ─────────────────────────────────────────────────────

const ICON_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ICON_CACHE_KEY = 'sz_app_icons_v1';

interface IconCacheEntry {
    icon: string;
    ts: number;
}

function getBrowserIconCache(): Record<string, IconCacheEntry> {
    try {
        const raw = localStorage.getItem(ICON_CACHE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function setBrowserIconCache(cache: Record<string, IconCacheEntry>) {
    try {
        localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(cache));
    } catch {
        // storage full or disabled
    }
}

function getCachedIcon(appId: string): string | null {
    const cache = getBrowserIconCache();
    const entry = cache[appId];
    if (!entry) return null;
    if (Date.now() - entry.ts > ICON_CACHE_TTL_MS) {
        // expired
        delete cache[appId];
        setBrowserIconCache(cache);
        return null;
    }
    return entry.icon;
}

function setCachedIcon(appId: string, icon: string) {
    const cache = getBrowserIconCache();
    cache[appId] = { icon, ts: Date.now() };
    setBrowserIconCache(cache);
}

// ─── Store Icon Resolvers (via backend proxy) ───────────────────────────────

function extractAppleAppId(url: string): string | null {
    const match = url.match(/id(\d+)/);
    return match ? match[1] : null;
}

function extractGooglePlayPackage(url: string): string | null {
    const match = url.match(/[?&]id=([^&]+)/);
    return match ? match[1] : null;
}

async function fetchStoreIcon(app: GovApp): Promise<string | null> {
    // Check browser cache first
    const cached = getCachedIcon(app.id);
    if (cached) return cached;

    // 1. Google Play Store (priority)
    if (app.links.android) {
        const pkg = extractGooglePlayPackage(app.links.android);
        if (pkg) {
            try {
                const res = await fetch(`/api/app-icon?store=play&package=${encodeURIComponent(pkg)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.icon) {
                        setCachedIcon(app.id, data.icon);
                        return data.icon;
                    }
                }
            } catch {
                // ignore
            }
        }
    }

    // 2. Apple App Store
    if (app.links.apple) {
        const appId = extractAppleAppId(app.links.apple);
        if (appId) {
            try {
                const res = await fetch(`/api/app-icon?store=apple&id=${encodeURIComponent(appId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.icon) {
                        setCachedIcon(app.id, data.icon);
                        return data.icon;
                    }
                }
            } catch {
                // ignore
            }
        }
    }

    return null;
}

// ─── Icon Component ─────────────────────────────────────────────────────────

function getFaviconUrl(officialUrl: string | undefined): string | null {
    if (!officialUrl) return null;
    try {
        const url = new URL(officialUrl);
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
    } catch {
        return null;
    }
}

function AppIcon({ app, storeIcon, className, placeholderClassName }: {
    app: GovApp;
    storeIcon?: string | null;
    className?: string;
    placeholderClassName?: string;
}) {
    // Priority: 1) Store icon  2) Local CSV icon  3) Website favicon  4) Placeholder
    // Use || instead of ?? so empty strings are treated as falsy
    const src = storeIcon || app.icon || getFaviconUrl(app.links.official) || null;

    if (src) {
        return <img src={src} alt={app.name} loading="lazy" decoding="async" className={className} />;
    }

    return (
        <div className={`flex items-center justify-center ${className || ''}`}>
            <Smartphone className={placeholderClassName || 'h-8 w-8 text-muted-foreground/30'} />
        </div>
    );
}

// ─── Detail View ────────────────────────────────────────────────────────────

function AppDetailView({ app, isDesktop, storeIcon }: {
    app: GovApp;
    isDesktop: boolean;
    storeIcon?: string | null;
}) {
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };
    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Handle for visual bottom sheet feel - mobile only */}
            {!isDesktop && (
                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto my-3 flex-shrink-0" />
            )}

            {/* Compact Row Header — icon + name only, no description */}
            <div className="px-6 py-4 flex items-center gap-4">
                <div className="relative h-16 w-16 rounded-2xl overflow-hidden border shadow-sm flex-shrink-0 bg-white">
                    <AppIcon app={app} storeIcon={storeIcon} className="absolute inset-0 h-full w-full object-cover" placeholderClassName="h-8 w-8 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold truncate">{app.name}</div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-8 min-w-0">
                {/* Action Buttons — grid so they never overflow the modal */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {app.links.android && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.android} target="_blank" rel="noopener noreferrer">
                                <AndroidIcon className="ml-2 h-5 w-5" />
                                أندرويد
                            </a>
                        </Button>
                    )}
                    {app.links.apple && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.apple} target="_blank" rel="noopener noreferrer">
                                <IosIcon className="ml-2 h-5 w-5" />
                                آيفون
                            </a>
                        </Button>
                    )}
                    {app.links.official && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.official} target="_blank" rel="noopener noreferrer">
                                <Globe className="ml-2 h-5 w-5" />
                                الموقع الرسمي
                            </a>
                        </Button>
                    )}
                </div>

                {/* Full Description — shown once, not duplicated in header */}
                {app.description && (
                    <div className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">
                        {app.description}
                    </div>
                )}

                {/* Screenshot Slider */}
                {app.images && app.images.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-base text-foreground">لقطات الشاشة</h4>
                            <span className="text-xs text-muted-foreground">{app.images.length} صور</span>
                        </div>
                        <div className="relative w-full overflow-hidden">
                            <div
                                ref={scrollRef}
                                className={`flex gap-3 pb-2 overflow-x-auto scrollbar-hide select-none touch-pan-x ${isDesktop ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing snap-none' : 'snap-x snap-mandatory'}`}
                                onMouseDown={handleMouseDown}
                                onMouseLeave={handleMouseLeave}
                                onMouseUp={handleMouseUp}
                                onMouseMove={handleMouseMove}
                                dir="rtl"
                            >
                                {app.images.map((img, i) => (
                                    <div key={i} className="relative w-32 sm:w-36 aspect-[9/16] shrink-0 overflow-hidden rounded-xl border bg-muted/20 shadow-md snap-start">
                                        <img
                                            src={img}
                                            alt={`Screenshot ${i + 1}`}
                                            className="absolute inset-0 h-full w-full object-contain"
                                            draggable={false}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GovAppsClient({ initialData }: GovAppsClientProps) {
    const [selectedApp, setSelectedApp] = useState<GovApp | null>(null);
    const [storeIcons, setStoreIcons] = useState<Record<string, string>>({});
    const isDesktop = useMediaQuery('(min-width: 768px)');

    // Fetch store icons on mount
    useEffect(() => {
        let cancelled = false;

        async function loadIcons() {
            const resolved: Record<string, string> = {};

            for (const app of initialData) {
                if (cancelled) return;
                const icon = await fetchStoreIcon(app);
                if (icon) {
                    resolved[app.id] = icon;
                }
            }

            if (!cancelled) {
                setStoreIcons(resolved);
            }
        }

        loadIcons();
        return () => { cancelled = true; };
    }, [initialData]);

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
                        دليل التطبيقات الحكومية الرسمية
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
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3">
                        {initialData.map((app) => (
                            <Card key={app.id} className="overflow-hidden hover:shadow-md transition-shadow border-0 shadow-sm bg-card group flex flex-col h-full relative">
                                <div className="aspect-square w-full bg-muted relative overflow-hidden cursor-pointer" onClick={() => setSelectedApp(app)}>
                                    {isSuperAdmin && (
                                        <a
                                            href={`/admin/govapps?edit=${app.id}`}
                                            onClick={(e) => e.stopPropagation()}
                                            className="absolute top-1.5 start-1.5 z-10 p-1 rounded-md bg-background/90 hover:bg-primary hover:text-primary-foreground text-foreground backdrop-blur-md border shadow-sm transition-all text-xs font-bold flex items-center gap-1"
                                            title="تعديل التطبيق في لوحة التحكم"
                                        >
                                            <Pencil className="w-3 h-3" />
                                        </a>
                                    )}
                                    <AppIcon
                                        app={app}
                                        storeIcon={getIconForApp(app)}
                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        placeholderClassName="h-10 w-10 text-muted-foreground/30"
                                    />
                                </div>

                                <CardContent className="p-2.5 text-center flex-grow flex flex-col justify-between">
                                    <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors mb-1" onClick={() => setSelectedApp(app)}>
                                        {app.name}
                                    </h3>

                                    <div className="flex flex-wrap justify-center gap-1 pt-1.5 border-t border-border mt-auto">
                                        {app.links.android && (
                                            <a
                                                href={app.links.android}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-[#3DDC84] transition-colors p-0.5"
                                                title="Android"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <AndroidIcon className="h-6 w-6" />
                                            </a>
                                        )}
                                        {app.links.apple && (
                                            <a
                                                href={app.links.apple}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                                                title="iOS"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <IosIcon className="h-6 w-6" />
                                            </a>
                                        )}
                                        {app.links.official && (
                                            <a
                                                href={app.links.official}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                                                title="Website"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Globe className="h-6 w-6" />
                                            </a>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Desktop: Dialog Modal */}
            {isDesktop && (
                <Dialog open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
                    <DialogContent className="max-w-2xl p-0 overflow-hidden" dir="rtl">
                        <DialogHeader className="sr-only">
                            <DialogTitle>{selectedApp?.name || 'تفاصيل التطبيق'}</DialogTitle>
                            <DialogDescription>{selectedApp?.description || ''}</DialogDescription>
                        </DialogHeader>
                        {selectedApp && <AppDetailView app={selectedApp} isDesktop={true} storeIcon={getIconForApp(selectedApp)} />}
                    </DialogContent>
                </Dialog>
            )}

            {/* Mobile: Sheet Bottom Drawer */}
            {!isDesktop && (
                <Sheet open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
                    <SheetContent
                        side="bottom"
                        className="h-[90vh] rounded-t-3xl border-t p-0 overflow-hidden shadow-2xl border-none"
                    >
                        <SheetHeader className="sr-only">
                            <SheetTitle>{selectedApp?.name || 'تفاصيل التطبيق'}</SheetTitle>
                            <SheetDescription>{selectedApp?.description || ''}</SheetDescription>
                        </SheetHeader>
                        {selectedApp && <AppDetailView app={selectedApp} isDesktop={false} storeIcon={getIconForApp(selectedApp)} />}
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}
