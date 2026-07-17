import React, { useState, useEffect, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import MainLayout from '@/Layouts/MainLayout';
import centralData from './data/central-directory.json';
import { getCanonicalCityName } from '@/Lib/city-name-standardizer';

// UI components
import { Card, CardContent } from "@/Components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/Components/ui/dialog";
import { Input } from "@/Components/ui/input";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";

// Lucide icons
import {
    MapPin, Globe, Send, Smartphone, Phone, Link as LinkIcon,
    Search, Shield, Landmark, Calendar, Info, User, ExternalLink,
    Building2, Layers, Sparkles, Anchor, GraduationCap, HeartPulse, Scale,
    Zap, Briefcase, Sprout, Coins, Hammer, Tv, Siren, BookOpen, Users,
    Train, Newspaper, Compass, Trophy, Eye, UserCheck, ShieldAlert
} from 'lucide-react';
import { Facebook } from '@/Components/ui/icons';

// Component to render individual governorate SVGs dynamically from geojson
interface GovernorateSVGProps {
    feature: any;
    className?: string;
}

function GovernorateSVG({ feature, className = "w-16 h-16" }: GovernorateSVGProps) {
    const projectedPath = useMemo(() => {
        if (!feature || !feature.geometry) return null;
        const { type, coordinates } = feature.geometry;
        let allPoints: [number, number][] = [];

        // Extract all coordinates to calculate bounds
        if (type === "Polygon") {
            coordinates.forEach((ring: [number, number][]) => {
                allPoints.push(...ring);
            });
        } else if (type === "MultiPolygon") {
            coordinates.forEach((polygon: [number, number][][]) => {
                polygon.forEach((ring: [number, number][]) => {
                    allPoints.push(...ring);
                });
            });
        }

        if (allPoints.length === 0) return null;

        // Calculate bounding box (Lon, Lat)
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        allPoints.forEach(([x, y]) => {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        });

        // Add padding
        const width = maxX - minX;
        const height = maxY - minY;
        const paddingX = width * 0.1;
        const paddingY = height * 0.1;

        const finalMinX = minX - paddingX;
        const finalMaxX = maxX + paddingX;
        const finalMinY = minY - paddingY;
        const finalMaxY = maxY + paddingY;

        const finalWidth = finalMaxX - finalMinX;
        const finalHeight = finalMaxY - finalMinY;

        const project = (lon: number, lat: number) => {
            const x = lon - finalMinX;
            const y = finalMaxY - lat; // Flip Y
            return `${x.toFixed(4)},${y.toFixed(4)}`;
        };

        let pathData = "";
        if (type === "Polygon") {
            coordinates.forEach((ring: [number, number][]) => {
                pathData += ring.map((pt, i) => (i === 0 ? "M" : "L") + project(pt[0], pt[1])).join(" ") + " Z ";
            });
        } else if (type === "MultiPolygon") {
            coordinates.forEach((polygon: [number, number][][]) => {
                polygon.forEach((ring: [number, number][]) => {
                    pathData += ring.map((pt, i) => (i === 0 ? "M" : "L") + project(pt[0], pt[1])).join(" ") + " Z ";
                });
            });
        }

        return { pathData, width: finalWidth, height: finalHeight };
    }, [feature]);

    if (!projectedPath) {
        return (
            <div className={`${className} bg-muted rounded-lg flex items-center justify-center border border-border/40 text-muted-foreground/35`}>
                <MapPin className="w-5 h-5" />
            </div>
        );
    }

    const { pathData, width, height } = projectedPath;

    return (
        <svg 
            viewBox={`0 0 ${width} ${height}`} 
            className={className} 
            xmlns="http://www.w3.org/2000/svg"
        >
            <path 
                d={pathData.trim()} 
                className="fill-primary/10 stroke-primary transition-colors group-hover:fill-primary/20" 
                strokeWidth={(width / 45)} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
            />
        </svg>
    );
}

// Get specific custom icon for committees and ministries based on entity id
const getCategoryIcon = (id: string, category: string) => {
    if (category === 'entities') {
        switch (id) {
            case 'presidency_office': return <UserCheck className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />;
            case 'control_inspection': return <ShieldAlert className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />;
            case 'ports_customs': return <Scale className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />;
            case 'service_extension_committee': return <Layers className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />;
            case 'syrian_ports': return <Anchor className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />;
            default: return <Shield className="w-8 h-8 text-amber-500 group-hover:scale-110 transition-transform" />;
        }
    }
    
    // Ministries icon mapping
    switch (id) {
        case 'mofa': return <Globe className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'defense': return <Shield className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'interior': return <Eye className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'energy': return <Zap className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'finance': return <Coins className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'economy_industry': return <Briefcase className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'justice': return <Scale className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'awqaf': return <BookOpen className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'higher_education': return <GraduationCap className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'health': return <HeartPulse className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'local_admin': return <MapPin className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'telecommunications': return <Smartphone className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'education': return <BookOpen className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'social_affairs': return <Users className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'public_works': return <Hammer className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'emergency_disaster': return <Siren className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'transport': return <Train className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'admin_development': return <User className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'culture': return <BookOpen className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'tourism': return <Compass className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'sports_youth': return <Trophy className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'agriculture': return <Sprout className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        case 'media': return <Newspaper className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
        default: return <Building2 className="w-8 h-8 text-primary group-hover:scale-110 transition-transform" />;
    }
};

// Get appropriate icon for different link types
const getLinkIcon = (type: string) => {
    switch (type) {
        case 'website': return <Globe className="w-4 h-4 text-primary" />;
        case 'facebook': return <Facebook className="w-4 h-4 text-primary" />;
        case 'telegram': return <Send className="w-4 h-4 text-primary" />;
        case 'x': return <Sparkles className="w-4 h-4 text-primary" />;
        case 'app': return <Smartphone className="w-4 h-4 text-primary" />;
        case 'phone': return <Phone className="w-4 h-4 text-primary" />;
        default: return <LinkIcon className="w-4 h-4 text-muted-foreground" />;
    }
};

// Translate link types to Arabic
const getLinkTypeAr = (type: string) => {
    switch (type) {
        case 'website': return 'الموقع الرسمي';
        case 'facebook': return 'فيسبوك';
        case 'telegram': return 'تلغرام';
        case 'x': return 'منصة إكس';
        case 'app': return 'تطبيق ذكي';
        case 'phone': return 'هاتف خدمي';
        default: return 'روابط أخرى';
    }
};

const CATEGORIES = [
    { key: 'all', label: 'الكل' },
    { key: 'governorates', label: 'المحافظات' },
    { key: 'entities', label: 'الهيئات' },
    { key: 'ministries', label: 'الوزارات' },
];

export default function CentralDirectoryPage() {
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [currentCategory, setCurrentCategory] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [selectedCard, setSelectedCard] = useState<any | null>(null);

    // Ensure HTML and Body have dir="rtl" on mount and restore on unmount
    useEffect(() => {
        const prevHtmlDir = document.documentElement.dir;
        const prevBodyDir = document.body.dir;
        document.documentElement.dir = 'rtl';
        document.body.dir = 'rtl';
        return () => {
            document.documentElement.dir = prevHtmlDir;
            document.body.dir = prevBodyDir;
        };
    }, []);

    // Fetch GeoJSON for the governorates mapping
    useEffect(() => {
        fetch('/assets/population/syr_admin1.geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Failed to load Syria GeoJSON', err));
    }, []);

    // Unify all database entries into a single array
    const allItems = useMemo(() => {
        const govs = centralData.governorates.map(gov => ({
            id: gov.id,
            name: gov.nameAr,
            subtitle: gov.nameEn,
            image: '',
            category: 'governorates' as const,
            rawItem: { ...gov, isGov: true }
        }));
        
        const entities = centralData.presidency.entities.map(ent => ({
            id: ent.id,
            name: ent.name,
            subtitle: ent.head,
            image: ent.image,
            category: 'entities' as const,
            rawItem: { ...ent, isEntity: true }
        }));
        
        const ministries = centralData.presidency.ministries.map(min => ({
            id: min.id,
            name: min.name,
            subtitle: min.head,
            image: min.image,
            category: 'ministries' as const,
            rawItem: { ...min, isMinistry: true }
        }));
        
        return [...govs, ...entities, ...ministries];
    }, []);

    // Filter unified list based on active category and search input
    const filteredItems = useMemo(() => {
        let items = allItems;
        
        if (currentCategory !== 'all') {
            items = items.filter(item => item.category === currentCategory);
        }
        
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            items = items.filter(item => 
                item.name.toLowerCase().includes(term) ||
                item.subtitle.toLowerCase().includes(term) ||
                (item.rawItem.description && item.rawItem.description.toLowerCase().includes(term)) ||
                (item.rawItem.tasks && item.rawItem.tasks.toLowerCase().includes(term)) ||
                (item.rawItem.notes && item.rawItem.notes.toLowerCase().includes(term))
            );
        }
        
        return items;
    }, [allItems, currentCategory, searchTerm]);

    // Match geojson features to governorate cards
    const getGovFeature = (nameAr: string) => {
        if (!geoJsonData) return null;
        return geoJsonData.features.find((f: any) => {
            const name = f.properties.province_name || f.properties.ADM1_AR || f.properties.ADM2_AR || f.properties.Name;
            return getCanonicalCityName(name) === nameAr;
        });
    };

    return (
        <MainLayout>
            <Head>
                <title>الدليل المركزي - جرد</title>
                <meta name="description" content="الدليل المركزي السوري - دليل المحافظات السورية وهيكلية الرئاسة والوزارات واللجان." />
            </Head>

            <div className="min-h-screen bg-background text-foreground transition-colors" dir="rtl">
                {/* Header / Hero */}
                <section className="bg-card py-10 shadow-sm border-b border-border">
                    <div className="container mx-auto px-4 text-center max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground">الدليل المركزي السوري</h1>
                    </div>
                </section>

                {/* Main Content */}
                <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">

                    {/* Search and Filters Section */}
                    <div className="max-w-xl mx-auto space-y-4">
                        <div className="relative">
                            <Search className="absolute end-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="ابحث عن محافظة، وزارة، هيئة، مسؤول..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full ps-3 pe-10 text-start bg-muted/40 border-border text-foreground placeholder-muted-foreground text-xs rounded-xl focus-visible:ring-primary focus-visible:border-primary"
                            />
                        </div>

                        {/* Category Filter Badges */}
                        <div className="flex flex-wrap justify-center gap-2 pt-1">
                            {CATEGORIES.map(cat => (
                                <Button
                                    key={cat.key}
                                    variant={currentCategory === cat.key ? "default" : "outline"}
                                    onClick={() => setCurrentCategory(cat.key)}
                                    className="rounded-full font-bold px-4 py-1 text-xs transition-all hover:scale-105 h-8"
                                >
                                    {cat.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Unified Grid (7 columns desktop, 2 columns mobile) */}
                    {filteredItems.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-[repeat(7,minmax(0,1fr))] gap-4 pt-4">
                            {filteredItems.map((item) => (
                                <Card
                                    key={`${item.category}-${item.id}`}
                                    onClick={() => setSelectedCard(item.rawItem)}
                                    className="border-border bg-card/45 hover:bg-card/90 transition-all cursor-pointer shadow-sm group hover:border-primary/45 rounded-xl text-center flex flex-col justify-between"
                                >
                                    <CardContent className="p-4 flex flex-col items-center justify-center gap-3 h-full">
                                        {/* Dynamic Icon / SVG Map shape */}
                                        <div className="w-16 h-16 flex items-center justify-center shrink-0">
                                            {item.category === 'governorates' ? (
                                                <GovernorateSVG feature={getGovFeature(item.name)} className="w-16 h-16" />
                                            ) : item.image ? (
                                                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-border/45 shadow-inner shrink-0 bg-muted hover:scale-105 transition-transform duration-300">
                                                    <img 
                                                        src={`/syofficial-assets/${item.image}`} 
                                                        alt={item.subtitle} 
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-muted rounded-2xl border border-border/40 text-muted-foreground transition-colors">
                                                    {getCategoryIcon(item.id, item.category)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card Titles */}
                                        <div className="space-y-1 w-full min-w-0">
                                            <h3 className="text-xs md:text-sm font-bold text-foreground line-clamp-2 leading-snug">
                                                {item.name}
                                            </h3>
                                            <span className="text-[9px] text-muted-foreground block truncate">
                                                {item.category === 'governorates' ? item.subtitle : `المسؤول: ${item.subtitle}`}
                                            </span>
                                        </div>

                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-16 text-muted-foreground text-xs border border-dashed border-border rounded-2xl max-w-md mx-auto">
                            لا توجد نتائج تطابق خيارات البحث الحالية.
                        </div>
                    )}
                </div>

                {/* DETAILS POP-UP (DIALOG) */}
                <Dialog open={!!selectedCard} onOpenChange={(open) => !open && setSelectedCard(null)}>
                    <DialogContent className="sm:max-w-[480px] bg-card border border-border text-foreground p-6 rounded-2xl text-start" dir="rtl">
                        {selectedCard && (
                            <div className="space-y-6">
                                <DialogHeader className="text-right sm:text-right border-b border-border pb-4">
                                    <div className="flex gap-4 items-start">
                                        {!selectedCard.isGov && selectedCard.image && (
                                            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-border/40 shadow-inner shrink-0 bg-muted">
                                                <img 
                                                    src={`/syofficial-assets/${selectedCard.image}`} 
                                                    alt={selectedCard.head} 
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="space-y-1 w-full min-w-0">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Badge variant="outline" className={
                                                    selectedCard.isGov ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5 px-2.5 py-0.5 text-[10px]" :
                                                    selectedCard.isEntity ? "text-amber-500 border-amber-500/20 bg-amber-500/5 px-2.5 py-0.5 text-[10px]" :
                                                    "text-primary border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px]"
                                                }>
                                                    {selectedCard.isGov ? "محافظة سورية" :
                                                     selectedCard.isEntity ? "هيئة سيادية" :
                                                     "حقيبة وزارية"}
                                                </Badge>
                                            </div>
                                            <DialogTitle className="text-lg md:text-xl font-extrabold text-foreground leading-snug text-start">
                                                {selectedCard.isGov ? `محافظة ${selectedCard.nameAr}` : selectedCard.name}
                                            </DialogTitle>
                                            {!selectedCard.isGov && (
                                                <DialogDescription className="text-muted-foreground text-xs mt-1.5 flex items-center gap-1 text-start">
                                                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> 
                                                    <span className="font-semibold text-foreground">
                                                        {selectedCard.isMinistry ? `الوزير المسؤول: ${selectedCard.head}` : `الرئيس/المدير المسؤول: ${selectedCard.head}`}
                                                    </span>
                                                </DialogDescription>
                                            )}
                                        </div>
                                    </div>
                                </DialogHeader>



                                {/* Interactive Links */}
                                <div className="space-y-3 pt-2">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider text-start">قنوات الاتصال والروابط الرسمية</h4>
                                    {selectedCard.links && selectedCard.links.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {selectedCard.links.map((link: any, idx: number) => (
                                                <a
                                                    key={idx}
                                                    href={link.type === 'phone' ? `tel:${link.value}` : link.value}
                                                    target={link.type === 'phone' ? '_self' : '_blank'}
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 hover:border-border transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-background rounded-lg group-hover:scale-105 transition-transform border border-border/40">
                                                            {getLinkIcon(link.type)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-[10px] text-muted-foreground">{getLinkTypeAr(link.type)}</div>
                                                            <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors text-start">{link.label}</div>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-border rounded-xl flex items-center justify-center gap-2">
                                            <Info className="w-4 h-4" />
                                            <span>لا توجد روابط اتصال مسجلة حالياً</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </DialogContent>
                </Dialog>
            </div>
        </MainLayout>
    );
}
