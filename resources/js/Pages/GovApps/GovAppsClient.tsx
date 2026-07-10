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
import { ExternalLink, Images as ImageIcon, Globe } from "lucide-react";

function AndroidIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" className={className} fill="currentColor">
            <path d="M270.1 741.7c0 23.4 19.1 42.5 42.6 42.5h48.7v120.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V784.1h85v120.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V784.1h48.7c23.5 0 42.6-19.1 42.6-42.5V346.4h-486zm357.1-600.1l44.9-65c2.6-3.8 2-8.9-1.5-11.4c-3.5-2.4-8.5-1.2-11.1 2.6l-46.6 67.6c-30.7-12.1-64.9-18.8-100.8-18.8s-70.1 6.7-100.8 18.8l-46.6-67.5c-2.6-3.8-7.6-5.1-11.1-2.6c-3.5 2.4-4.1 7.4-1.5 11.4l44.9 65c-71.4 33.2-121.4 96.1-127.8 169.6h486c-6.6-73.6-56.7-136.5-128-169.7M409.5 244.1a26.9 26.9 0 1 1 26.9-26.9a26.97 26.97 0 0 1-26.9 26.9m208.4 0a26.9 26.9 0 1 1 26.9-26.9a26.97 26.97 0 0 1-26.9 26.9m223.4 100.7c-30.2 0-54.6 24.8-54.6 55.4v216.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V400.1c.1-30.6-24.3-55.3-54.6-55.3m-658.6 0c-30.2 0-54.6 24.8-54.6 55.4v216.4c0 30.5 24.5 55.4 54.6 55.4c30.2 0 54.6-24.8 54.6-55.4V400.1c0-30.6-24.5-55.3-54.6-55.3"/>
        </svg>
    );
}

function IosIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M14.53 2.53a.75.75 0 0 0-1.06-1.06l-1 1a.75.75 0 0 0 1.06 1.06zM9.656 4.42c.613 0 1.084.216 1.495.405c.32.146.602.276.889.276c.286 0 .634-.13 1.026-.276c.506-.189 1.084-.405 1.698-.405c.773 0 1.766.439 2.48 1.316c-.396.26-1.187 1.039-1.187 2.77c0 1.343 1.129 2.4 1.693 2.604c-.614 2.035-1.812 3.867-2.986 3.867c-.51 0-.936-.17-1.362-.34s-.852-.34-1.362-.34s-.852.17-1.192.34c-.341.17-.682.34-1.192.34c-1.68 0-3.406-3.746-3.406-6.47c0-2.725 2.043-4.087 3.406-4.087M5.5 15.586a1 1 0 1 0 0 2a1 1 0 0 0 0-2m11.5.664c-1.914 0-2.75 1.336-2.75 2.25c0 .8.568 1.247 1.04 1.483c.45.225 1.017.367 1.483.483l.045.012c.526.131.936.237 1.222.38c.135.068.19.12.21.142v.001c-.002.09-.169.749-1.25.749c-1.086 0-1.25-.664-1.25-.75h-1.5c0 .914.836 2.25 2.75 2.25s2.75-1.336 2.75-2.25c0-.8-.568-1.247-1.04-1.483c-.45-.225-1.017-.367-1.483-.483l-.045-.012c-.526-.131-.936-.237-1.222-.38a.7.7 0 0 1-.21-.142v-.001c.002-.09.169-.749 1.25-.749c.265 0 .6.143.895.389c.14.117.245.236.31.332a.5.5 0 0 1 .051.093a.3.3 0 0 1-.006-.064h1.5c0-.344-.157-.65-.298-.861a3.1 3.1 0 0 0-.597-.653c-.455-.38-1.12-.736-1.855-.736m-1.25 2.249v.001c-.002-.001-.003-.005 0-.001M18.25 21v-.001c.002.001.003.005 0 .001m-7.75-3.25c-.9 0-1.75.827-1.75 2s.85 2 1.75 2s1.75-.827 1.75-2s-.85-2-1.75-2m-3.25 2c0-1.864 1.39-3.5 3.25-3.5s3.25 1.636 3.25 3.5s-1.39 3.5-3.25 3.5s-3.25-1.636-3.25-3.5m-2.5-1.25v4.75h1.5V18.5z"/>
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
        return <img src={src} alt={app.name} className={className} />;
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
                                <AndroidIcon className="ml-2 h-4 w-4" />
                                أندرويد
                            </a>
                        </Button>
                    )}
                    {app.links.apple && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.apple} target="_blank" rel="noopener noreferrer">
                                <IosIcon className="ml-2 h-4 w-4" />
                                آيفون
                            </a>
                        </Button>
                    )}
                    {app.links.official && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.official} target="_blank" rel="noopener noreferrer">
                                <Globe className="ml-2 h-4 w-4" />
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

    const getIconForApp = useCallback((app: GovApp) => storeIcons[app.id] || null, [storeIcons]);

    return (
        <div className="min-h-screen bg-background" dir="rtl">
            <section className="bg-card py-10 shadow-sm border-b border-border">
                <div className="container mx-auto px-4 text-center max-w-4xl">
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
                            <Card key={app.id} className="overflow-hidden hover:shadow-md transition-shadow border-0 shadow-sm bg-card group flex flex-col h-full">
                                <div className="aspect-square w-full bg-muted relative overflow-hidden cursor-pointer" onClick={() => setSelectedApp(app)}>
                                    <AppIcon
                                        app={app}
                                        storeIcon={getIconForApp(app)}
                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        placeholderClassName="h-10 w-10 text-muted-foreground/30"
                                    />
                                </div>

                                <CardContent className="p-2.5 text-center flex-grow flex flex-col justify-between">
                                    <h3 className="font-semibold text-foreground text-xs leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors mb-1" onClick={() => setSelectedApp(app)}>
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
                                                <AndroidIcon className="h-4 w-4" />
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
                                                <IosIcon className="h-4 w-4" />
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
                                                <Globe className="h-4 w-4" />
                                            </a>
                                        )}
                                        <button
                                            className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                                            onClick={() => setSelectedApp(app)}
                                            title="عرض التفاصيل"
                                        >
                                            <ImageIcon className="h-4 w-4" />
                                        </button>
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
