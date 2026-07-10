"use client";
import React, { useState, useEffect } from 'react';
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
import { ExternalLink, Smartphone, Apple, Images as ImageIcon, Globe } from "lucide-react";


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

function getFaviconUrl(officialUrl: string | undefined): string | null {
    if (!officialUrl) return null;
    try {
        const url = new URL(officialUrl);
        return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=128`;
    } catch {
        return null;
    }
}

function AppIcon({ app, className, placeholderClassName }: { app: GovApp; className?: string; placeholderClassName?: string }) {
    if (app.icon) {
        return <img src={app.icon} alt={app.name} className={className} />;
    }
    const favicon = getFaviconUrl(app.links.official);
    if (favicon) {
        return <img src={favicon} alt={app.name} className={className} />;
    }
    return (
        <div className={`flex items-center justify-center ${className || ''}`}>
            <Smartphone className={placeholderClassName || 'h-8 w-8 text-muted-foreground/30'} />
        </div>
    );
}

function AppDetailView({ app, isDesktop }: { app: GovApp; isDesktop: boolean }) {
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
                    <AppIcon app={app} className="absolute inset-0 h-full w-full object-cover" placeholderClassName="h-8 w-8 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold truncate">{app.name}</div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-10 space-y-8 min-w-0">
                {/* Action Buttons — grid so they never overflow the modal */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                    {app.links.android && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.android} target="_blank" rel="noopener noreferrer">
                                <Smartphone className="ml-2 h-4 w-4" />
                                أندرويد
                            </a>
                        </Button>
                    )}
                    {app.links.apple && (
                        <Button asChild variant="outline" className="h-10 rounded-xl w-full">
                            <a href={app.links.apple} target="_blank" rel="noopener noreferrer">
                                <Apple className="ml-2 h-4 w-4" />
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

                {/* Seamless Screenshot Slider */}
                {app.images && app.images.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="font-bold text-base text-foreground">لقطات الشاشة</h4>
                            <span className="text-xs text-muted-foreground">{app.images.length} صور</span>
                        </div>
                        <div className=" -mx-6">
                            <div
                                ref={scrollRef}
                                className={`flex gap-4 px-6 pb-6 overflow-x-auto scrollbar-hide select-none ${isDesktop ? 'cursor-grab' : ''} ${isDragging ? 'cursor-grabbing snap-none' : 'snap-x snap-mandatory'}`}
                                onMouseDown={handleMouseDown}
                                onMouseLeave={handleMouseLeave}
                                onMouseUp={handleMouseUp}
                                onMouseMove={handleMouseMove}
                                dir="rtl"
                            >
                                {app.images.map((img, i) => (
                                    <div key={i} className="relative w-[75%] sm:w-64 aspect-[9/16] shrink-0 overflow-hidden rounded-2xl border bg-muted/20 shadow-lg snap-start pointer-events-none">
                                        <img
                                            src={img}
                                            alt={`Screenshot ${i + 1}`}
                                            className="absolute inset-0 h-full w-full object-contain"
                                        />
                                    </div>
                                ))}
                                <div className="w-6 shrink-0" />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function GovAppsClient({ initialData }: GovAppsClientProps) {
    const [selectedApp, setSelectedApp] = useState<GovApp | null>(null);
    const isDesktop = useMediaQuery('(min-width: 768px)');

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
                                                <Smartphone className="h-4 w-4" />
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
                                                <Apple className="h-4 w-4" />
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
                        {selectedApp && <AppDetailView app={selectedApp} isDesktop={true} />}
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
                        {selectedApp && <AppDetailView app={selectedApp} isDesktop={false} />}
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}
