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

export default function GovAppsClient({ initialData }: GovAppsClientProps) {
    const [selectedApp, setSelectedApp] = useState<GovApp | null>(null);
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const sheetSide = isDesktop ? "left" : "bottom";

    const scrollRef = React.useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        // PageX - offsetLeft gives position relative to container
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const handleMouseLeave = () => setIsDragging(false);
    const handleMouseUp = () => setIsDragging(false);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Multiplier for speed
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                        {initialData.map((app) => (
                            <Card key={app.id} className="overflow-hidden hover:shadow-lg transition-shadow border-0 shadow-md bg-card group flex flex-col h-full">
                                <div className="aspect-square w-full bg-muted relative overflow-hidden cursor-pointer" onClick={() => setSelectedApp(app)}>
                                    {app.icon ? (
                                        <img
                                            src={app.icon}
                                            alt={`${app.name} icon`}
                                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full w-full">
                                            <Smartphone className="h-12 w-12 text-muted-foreground/30" />
                                        </div>
                                    )}
                                </div>

                                <CardContent className="p-4 text-center flex-grow flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-foreground mb-2 leading-tight line-clamp-2 min-h-[3rem] cursor-pointer hover:text-primary transition-colors" onClick={() => setSelectedApp(app)}>
                                            {app.name}
                                        </h3>
                                        <p className="text-xs text-muted-foreground mb-4 line-clamp-2">
                                            {app.description}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap justify-center gap-2 pt-2 border-t border-border mt-auto">
                                        {app.links.android && (
                                            <a
                                                href={app.links.android}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-[#3DDC84] transition-colors p-1"
                                                title="Android"
                                            >
                                                <Smartphone className="h-5 w-5" />
                                            </a>
                                        )}
                                        {app.links.apple && (
                                            <a
                                                href={app.links.apple}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                                title="iOS"
                                            >
                                                <Apple className="h-5 w-5" />
                                            </a>
                                        )}
                                        {app.links.official && (
                                            <a
                                                href={app.links.official}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-primary transition-colors p-1"
                                                title="Website"
                                            >
                                                <Globe className="h-5 w-5" />
                                            </a>
                                        )}
                                        <button
                                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                                            onClick={() => setSelectedApp(app)}
                                            title="عرض التفاصيل"
                                        >
                                            <ImageIcon className="h-5 w-5" />
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Sheet open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
                <SheetContent
                    side={sheetSide}
                    className={`${isDesktop ? 'w-[450px] sm:max-w-md border-r' : 'h-[90vh] rounded-t-3xl border-t'} p-0 overflow-hidden shadow-2xl border-none`}
                >
                    {selectedApp && (
                        <div className="flex flex-col h-full bg-background">
                            {/* Handle for visual bottom sheet feel - mobile only */}
                            {!isDesktop && (
                                <div className="w-12 h-1.5 bg-muted rounded-full mx-auto my-3 flex-shrink-0" />
                            )}

                            {/* Compact Row Header */}
                            <div className="px-6 py-4 flex items-start gap-4">
                                <div className="relative h-16 w-16 rounded-2xl overflow-hidden border shadow-sm flex-shrink-0 bg-white">
                                    {selectedApp.icon ? (
                                        <img src={selectedApp.icon} alt={selectedApp.name} className="absolute inset-0 h-full w-full object-cover" />
                                    ) : (
                                        <Smartphone className="h-8 w-8 m-auto text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <SheetTitle className="text-xl font-bold mb-1">{selectedApp.name}</SheetTitle>
                                    <SheetDescription className="text-sm text-muted-foreground leading-snug line-clamp-2">
                                        {selectedApp.description}
                                    </SheetDescription>
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto px-6 pb-10 space-y-8">
                                {/* Simple Action Row */}
                                <div className="flex flex-wrap gap-3 pt-2">
                                    {selectedApp.links.android && (
                                        <Button asChild variant="outline" className="flex-1 min-w-[140px] h-11 rounded-xl">
                                            <a href={selectedApp.links.android} target="_blank" rel="noopener noreferrer">
                                                <Smartphone className="ml-2 h-4 w-4" />
                                                أندرويد
                                            </a>
                                        </Button>
                                    )}
                                    {selectedApp.links.apple && (
                                        <Button asChild variant="outline" className="flex-1 min-w-[140px] h-11 rounded-xl">
                                            <a href={selectedApp.links.apple} target="_blank" rel="noopener noreferrer">
                                                <Apple className="ml-2 h-4 w-4" />
                                                آيفون
                                            </a>
                                        </Button>
                                    )}
                                    {selectedApp.links.official && (
                                        <Button asChild variant="outline" className="flex-1 min-w-[140px] h-11 rounded-xl">
                                            <a href={selectedApp.links.official} target="_blank" rel="noopener noreferrer">
                                                <Globe className="ml-2 h-4 w-4" />
                                                الموقع الرسمي
                                            </a>
                                        </Button>
                                    )}
                                </div>

                                {/* Full Description if longer than line-clamp */}
                                <div className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap">
                                    {selectedApp.description}
                                </div>

                                {/* Seamless Screenshot Slider */}
                                {selectedApp.images && selectedApp.images.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="font-bold text-base text-foreground">لقطات الشاشة</h4>
                                            <span className="text-xs text-muted-foreground">{selectedApp.images.length} صور</span>
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
                                                {selectedApp.images.map((img, i) => (
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
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}
