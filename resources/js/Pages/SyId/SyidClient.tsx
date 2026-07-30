"use client";

import React, { useState, useMemo, Suspense, useEffect } from 'react';
import {
    Download, Copy, Check, ExternalLink, Map as MapIcon, FileDown, Search, Tag, Eye, Palette
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { Card, CardContent } from "@/Components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/Components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/Components/ui/tabs";
import { featureToSVG, getGovernorateNameAr } from '@/lib/geo-utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";
import { Input } from "@/Components/ui/input";

const SyriaMap = React.lazy(() => import('./SyriaMap'));

const COLOR_PALETTES = [
    {
        name: 'Forest',
        colors: [
            { hex: '#428177', hsl: 'hsl(171 32% 38%)', cmyk: 'C76% M32% Y54% K10%', oklch: 'oklch(0.536 0.061 189.6)', textColor: 'white' },
            { hex: '#054239', hsl: 'hsl(171 86% 14%)', cmyk: 'C89% M49% Y70% K50%', oklch: 'oklch(0.334 0.057 186.2)', textColor: 'white' },
            { hex: '#002623', hsl: 'hsl(173 100% 7%)', cmyk: 'C87% M59% Y68% K71%', oklch: 'oklch(0.208 0.038 184.5)', textColor: 'white' },
        ]
    },
    {
        name: 'Golden Wheat',
        colors: [
            { hex: '#edebe0', hsl: 'hsl(49 26% 90%)', cmyk: 'C6% M9% Y19% K0%', oklch: 'oklch(0.938 0.010 95.8)', textColor: 'black' },
            { hex: '#b9a779', hsl: 'hsl(43 32% 60%)', cmyk: 'C20% M29% Y52% K7%', oklch: 'oklch(0.722 0.063 88.5)', textColor: 'black' },
            { hex: '#988561', hsl: 'hsl(40 22% 49%)', cmyk: 'C39% M46% Y67% K20%', oklch: 'oklch(0.598 0.058 87.2)', textColor: 'white' },
        ]
    },
    {
        name: 'Deep Umber',
        colors: [
            { hex: '#6b1f2a', hsl: 'hsl(351 55% 27%)', cmyk: 'C35% M92% Y72% K46%', oklch: 'oklch(0.354 0.108 20.7)', textColor: 'white' },
            { hex: '#4a151e', hsl: 'hsl(350 56% 19%)', cmyk: 'C44% M86% Y68% K65%', oklch: 'oklch(0.279 0.083 19.5)', textColor: 'white' },
            { hex: '#260f14', hsl: 'hsl(348 43% 10%)', cmyk: 'C60% M75% Y64% K79%', oklch: 'oklch(0.183 0.039 18.2)', textColor: 'white' },
        ]
    },
    {
        name: 'Charcoal',
        colors: [
            { hex: '#ffffff', hsl: 'hsl(0 0% 100%)', cmyk: 'C0% M0% Y0% K0%', oklch: 'oklch(1 0 0)', textColor: 'black' },
            { hex: '#3d3a3b', hsl: 'hsl(340 3% 24%)', cmyk: 'C67% M53% Y60% K50%', oklch: 'oklch(0.344 0.005 348.0)', textColor: 'white' },
            { hex: '#161616', hsl: 'hsl(0 0% 9%)', cmyk: 'C73% M67% Y65% K80%', oklch: 'oklch(0.185 0 0)', textColor: 'white' },
        ]
    },
];

const HAYYAKUM_WEIGHTS = [
    { nameAr: 'خفيف (Light)', file: 'HayyakumAllah-Light', weightLabel: '300' },
    { nameAr: 'عادي (Regular)', file: 'HayyakumAllah-Regular', weightLabel: '400' },
    { nameAr: 'متوسط (Medium)', file: 'HayyakumAllah-Medium', weightLabel: '500' },
    { nameAr: 'عريض (Bold)', file: 'HayyakumAllah-Bold', weightLabel: '700' },
];

const LOGOTYPE_THEME_VARIANTS = [
    {
        id: 'darkgreen',
        nameAr: 'أخضر داكن (Forest)',
        description: 'مناسب للخلفيات الفاتحة والنمط الزيتي الرسمي',
        file: 'Syrian_logotype_darkgreen.svg',
        bgClass: 'bg-[#edebe0] dark:bg-[#054239]/40 border-border',
    },
    {
        id: 'black',
        nameAr: 'أسود (Charcoal / Light)',
        description: 'مناسب للتطبيقات الفاتحة والطباعة الأحادية',
        file: 'Syrian_logotype_black.svg',
        bgClass: 'bg-white text-black border-border',
    },
    {
        id: 'off-white',
        nameAr: 'أوف وايت (Dark / Off-white)',
        description: 'مناسب للخلفيات المظلمة والداكنة',
        file: 'Syrian_logotype_off-white.svg',
        bgClass: 'bg-[#161616] text-white border-border/40',
    }
];

const GOVERNORATE_ICONS = [
    { name: 'دمشق', landmark: 'السيف الدمشقي', file: 'السيف الدمشقي.svg' },
    { name: 'ريف دمشق', landmark: 'غوطة ريف دمشق', file: 'غوطة ريف دمشق.svg' },
    { name: 'حلب', landmark: 'قلعة حلب', file: 'قلعة حلب.svg' },
    { name: 'حمص', landmark: 'ساعة حمص', file: 'ساعة حمص.svg' },
    { name: 'حماة', landmark: 'نواعير حماة', file: 'نواعير حماة.svg' },
    { name: 'اللاذقية', landmark: 'قوس النصر', file: 'قوس النصر اللاذقية.svg' },
    { name: 'طرطوس', landmark: 'جزيرة أرواد', file: 'ارواد طرطوس.svg' },
    { name: 'إدلب', landmark: 'رويحة إدلب', file: 'رويحة ادلب.svg' },
    { name: 'دير الزور', landmark: 'الجسر المعلق', file: 'جسر دير الزور المعلق.svg' },
    { name: 'الرقة', landmark: 'بوابة بغداد', file: 'بوابة بغداد الرقة.svg' },
    { name: 'الحسكة', landmark: 'جسر عين ديوار', file: 'عين ديوار الحسكة.svg' },
    { name: 'درعا', landmark: 'المسجد العمري', file: 'مسجد درعا العمري.svg' },
    { name: 'السويداء', landmark: 'قنوات السويداء', file: 'قنوات السويداء.svg' },
    { name: 'القنيطرة', landmark: 'بيت صيدا', file: 'بيت صيدا القنيطرة.svg' },
];

const POSTER_THEMES = [
    {
        id: 'default',
        name: 'Classic',
        primary: '#04018c',
        bg: '#ffffff',
    },
    {
        id: 'forest',
        name: 'Forest',
        primary: '#054239',
        bg: '#edebe0',
    },
    {
        id: 'wheat',
        name: 'Golden Wheat',
        primary: '#988561',
        bg: '#fdfbf7',
    },
    {
        id: 'umber',
        name: 'Deep Umber',
        primary: '#6b1f2a',
        bg: '#fdf8f8',
    },
    {
        id: 'charcoal',
        name: 'Charcoal',
        primary: '#161616',
        bg: '#ffffff',
    }
];


const recolorSvg = (content: string, primaryColor: string, bgColor: string): string => {
    let res = content.replace(/#04018c/gi, primaryColor);
    res = res.replace(/fill:\s*#(?:fff|ffffff)/gi, `fill: ${bgColor}`);
    res = res.replace(/fill="#(?:fff|ffffff)"/gi, `fill="${bgColor}"`);
    return res;
};

export default function SyidClient() {
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [selectedGov, setSelectedGov] = useState<string>("full");
    const [govSearch, setGovSearch] = useState("");
    const [mapLoaded, setMapLoaded] = useState(false);
    const [loadingMap, setLoadingMap] = useState(false);
    const [loadFontPreview, setLoadFontPreview] = useState(false);
    const [activePosterTheme, setActivePosterTheme] = useState<string>('default');
    const [svgContents, setSvgContents] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadSvgs = async () => {
            const loaded: Record<string, string> = {};
            await Promise.all(
                GOVERNORATE_ICONS.map(async (icon) => {
                    try {
                        const res = await fetch(`/syid-assets/icons/governorates/with-frame/${encodeURIComponent(icon.file)}`);
                        const text = await res.text();
                        loaded[icon.file] = text;
                    } catch (e) {
                        console.error('Failed to load SVG', icon.file, e);
                    }
                })
            );
            setSvgContents(loaded);
        };
        loadSvgs();
    }, []);




    const loadMapData = async () => {
        if (geoJsonData || loadingMap) {
            setMapLoaded(true);
            return;
        }
        setLoadingMap(true);
        try {
            const res = await fetch('/assets/population/syria_provinces_opt.geojson');
            const data = await res.json();
            setGeoJsonData(data);
            setMapLoaded(true);
        } catch (err) {
            console.error('Failed to load GeoJSON', err);
            showToast('تعذر تحميل بيانات الخريطة');
        } finally {
            setLoadingMap(false);
        }
    };

    const governorates = useMemo(() => {
        if (!geoJsonData) return [];
        return geoJsonData.features
            .map((f: any) => ({
                id: f.properties.province_name,
                nameAr: getGovernorateNameAr(f.properties.province_name)
            }))
            .sort((a: any, b: any) => a.nameAr.localeCompare(b.nameAr, 'ar'));
    }, [geoJsonData]);

    const filteredGovernorates = useMemo(() => {
        return governorates.filter((gov: any) =>
            gov.nameAr.includes(govSearch)
        );
    }, [governorates, govSearch]);

    const handleExportSVG = async () => {
        if (!geoJsonData) {
            await loadMapData();
        }
        if (!geoJsonData) return;

        let svgString = "";
        let filename = "";

        if (selectedGov === "full") {
            svgString = featureToSVG(geoJsonData);
            filename = "خريطة_سوريا_كاملة.svg";
        } else {
            const feature = geoJsonData.features.find((f: any) => f.properties.province_name === selectedGov);
            if (!feature) return;
            svgString = featureToSVG(feature);
            const nameAr = getGovernorateNameAr(selectedGov);
            filename = `خريطة_سوريا_${nameAr}.svg`;
        }

        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`تم تحميل ملف SVG بنجاح`);
    };

    const handleExportGeoJSON = async () => {
        if (!geoJsonData) {
            await loadMapData();
        }
        if (!geoJsonData) return;

        let dataToExport = geoJsonData;
        let filename = "syria_provinces.geojson";

        if (selectedGov !== "full") {
            const feature = geoJsonData.features.find((f: any) => f.properties.province_name === selectedGov);
            if (!feature) return;
            dataToExport = { type: "FeatureCollection", features: [feature] };
            const nameAr = getGovernorateNameAr(selectedGov);
            filename = `خريطة_سوريا_${nameAr}.geojson`;
        }

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showToast(`تم تحميل ملف GeoJSON بنجاح`);
    };

    const showToast = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 2500);
    };

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
        showToast(`تم النسخ: ${text}`);
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors" dir="rtl">

            {/* Minimal Hero Header */}
            <header className="py-12 border-b border-border text-center bg-muted/20">
                <div className="container mx-auto px-4 max-w-4xl">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                        عناصر الهوية البصرية السورية
                    </h1>
                    <p className="text-muted-foreground text-base max-w-2xl mx-auto mb-6">
                        دليل متكامل ومجمّع للمواد الرقمية والملفات المتصلة بالهوية البصرية السورية
                    </p>
                    <a
                        href="https://syrianidentity.sy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 font-medium text-sm bg-[#428177] hover:bg-[#054239] text-white h-10 px-5 rounded-lg transition-colors shadow-xs"
                    >
                        <span>زيارة الموقع الرسمي</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <p className="mt-3 text-xs text-muted-foreground max-w-xl mx-auto leading-relaxed">
                        الموقع متوقف عن العمل منذ فترة، لتحميل الموجود فيه تحقق من قسم &quot;شعار الهوية والمواد الرسمية&quot;
                    </p>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="container mx-auto py-10 max-w-6xl px-4 space-y-14">

                {/* 1. COLOR PALETTES */}
                <section>
                    <h2 className="text-2xl font-bold mb-6">لوحة الألوان</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {COLOR_PALETTES.map((palette) => (
                            <Card key={palette.name} className="border border-border/80 rounded-xl overflow-hidden">
                                <div className="p-4 bg-muted/30 border-b border-border/40 font-semibold text-sm">
                                    {palette.name}
                                </div>
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-3 gap-2">
                                        {palette.colors.map((color) => {
                                            const hexKey = `${color.hex}-hex`;
                                            const hslKey = `${color.hex}-hsl`;
                                            const cmykKey = `${color.hex}-cmyk`;
                                            const oklchKey = `${color.hex}-oklch`;

                                            return (
                                                <div
                                                    key={color.hex}
                                                    className="p-3 rounded-lg flex flex-col justify-between min-h-[140px] border border-black/10 transition-all hover:scale-[1.02]"
                                                    style={{
                                                        backgroundColor: color.hex,
                                                        color: color.textColor
                                                    }}
                                                >
                                                    {/* HEX format click */}
                                                    <button
                                                        onClick={() => copyToClipboard(color.hex, hexKey)}
                                                        className="flex items-center justify-between w-full font-mono text-xs font-bold p-1 rounded bg-black/20 hover:bg-black/30 transition-colors"
                                                    >
                                                        <span>{color.hex}</span>
                                                        {copiedKey === hexKey ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 opacity-70" />}
                                                    </button>

                                                    {/* HSL, CMYK & OKLCH format clicks */}
                                                    <div className="space-y-1 text-[10px] font-mono dir-ltr mt-2">
                                                        <button
                                                            onClick={() => copyToClipboard(color.hsl, hslKey)}
                                                            className="flex items-center justify-between w-full p-0.5 px-1 rounded bg-black/15 hover:bg-black/25 transition-colors truncate"
                                                        >
                                                            <span className="truncate">{color.hsl}</span>
                                                            {copiedKey === hslKey ? <Check className="h-2.5 w-2.5 text-green-400 shrink-0" /> : <Copy className="h-2.5 w-2.5 opacity-60 shrink-0" />}
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(color.cmyk, cmykKey)}
                                                            className="flex items-center justify-between w-full p-0.5 px-1 rounded bg-black/15 hover:bg-black/25 transition-colors truncate"
                                                        >
                                                            <span className="truncate">{color.cmyk}</span>
                                                            {copiedKey === cmykKey ? <Check className="h-2.5 w-2.5 text-green-400 shrink-0" /> : <Copy className="h-2.5 w-2.5 opacity-60 shrink-0" />}
                                                        </button>
                                                        <button
                                                            onClick={() => copyToClipboard(color.oklch, oklchKey)}
                                                            className="flex items-center justify-between w-full p-0.5 px-1 rounded bg-black/15 hover:bg-black/25 transition-colors truncate"
                                                        >
                                                            <span className="truncate">{color.oklch}</span>
                                                            {copiedKey === oklchKey ? <Check className="h-2.5 w-2.5 text-green-400 shrink-0" /> : <Copy className="h-2.5 w-2.5 opacity-60 shrink-0" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* 2. TYPOGRAPHY */}
                <section>
                    <h2 className="text-2xl font-bold mb-6">الخطوط</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Card 1: Qomra Font */}
                        <Card className="border border-border/80 rounded-xl overflow-hidden flex flex-col justify-between p-6">
                            <div className="space-y-4">
                                <div className="flex justify-center bg-muted/20 p-4 rounded-lg border border-border">
                                    <img
                                        src="/syid-assets/materials/qomra2.webp"
                                        alt="خط قمرة"
                                        loading="lazy"
                                        className="max-h-48 w-auto rounded-md object-contain"
                                    />
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold">خط قمرة (Qomra Font)</h3>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        الخط المعتمد في نصوص الهوية البصرية السورية الجديدة المصمم من قبل وكالة iWantype.
                                    </p>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                                    <div className="flex items-center gap-2 text-xs">
                                        <Tag className="h-3.5 w-3.5 text-[#428177]" />
                                        <span>كود الخصم (25%):</span>
                                        <code className="font-mono font-bold text-foreground">syrianzone</code>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard('syrianzone', 'discount')}
                                        className="h-7 text-xs px-2"
                                    >
                                        {copiedKey === 'discount' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            </div>

                            <a
                                href="https://iwantype.com/product/qomra/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 w-full bg-[#428177] hover:bg-[#054239] text-white font-medium text-sm h-10 rounded-lg transition-colors mt-6"
                            >
                                <span>شراء الخطوط من iWantype</span>
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Card>

                        {/* Card 2: Hayyakum Allah Font */}
                        <Card className="border border-border/80 rounded-xl overflow-hidden flex flex-col justify-between p-6">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-bold">خط حيّاكم الله</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        خط قريب من خط الهوية البصرية السورية
                                    </p>
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    نسخة رقمية قريبة من المخطوطة البصرية للهوية السورية الجديدة، وتأتي بأربعة أوزان مختلفة (Light, Regular, Medium, Bold) لتناسب مختلف أغراض التصميم.
                                </p>

                                {/* Download Modal */}
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="w-full bg-[#428177] hover:bg-[#054239] text-white font-medium text-sm h-10 rounded-lg flex items-center justify-center gap-2">
                                            <Download className="h-4 w-4" />
                                            <span>تحميل خط حيّاكم الله</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md dir-rtl text-right sm:rounded-xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-lg font-bold text-right">تحميل خط حيّاكم الله</DialogTitle>
                                            <DialogDescription className="text-xs text-muted-foreground text-right">
                                                اختر الصيغة المناسبة لتنزيل الأوزان المتوفرة (Light, Regular, Medium, Bold).
                                            </DialogDescription>
                                        </DialogHeader>

                                        <Tabs defaultValue="ttf" className="w-full mt-2" dir="rtl">
                                            <TabsList className="grid grid-cols-3 w-full">
                                                <TabsTrigger value="ttf">TTF</TabsTrigger>
                                                <TabsTrigger value="woff">WOFF</TabsTrigger>
                                                <TabsTrigger value="woff2">WOFF2</TabsTrigger>
                                            </TabsList>
                                            {/* TTF Tab */}
                                            <TabsContent value="ttf" className="space-y-2 mt-4">
                                                {HAYYAKUM_WEIGHTS.map((weight) => (
                                                    <div key={`ttf-${weight.file}`} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                                                        <div>
                                                            <span className="font-medium text-sm block">{weight.nameAr}</span>
                                                            <span className="text-[11px] text-muted-foreground font-mono">{weight.file}.ttf</span>
                                                        </div>
                                                        <a
                                                            href={`/syid-assets/fonts/HayyakumAllah/TTF/${weight.file}.ttf`}
                                                            download
                                                            className="inline-flex items-center gap-1.5 bg-[#428177] hover:bg-[#054239] text-white text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            <span>تحميل</span>
                                                        </a>
                                                    </div>
                                                ))}
                                            </TabsContent>
                                            {/* WOFF Tab */}
                                            <TabsContent value="woff" className="space-y-2 mt-4">
                                                {HAYYAKUM_WEIGHTS.map((weight) => (
                                                    <div key={`woff-${weight.file}`} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                                                        <div>
                                                            <span className="font-medium text-sm block">{weight.nameAr}</span>
                                                            <span className="text-[11px] text-muted-foreground font-mono">{weight.file}.woff</span>
                                                        </div>
                                                        <a
                                                            href={`/syid-assets/fonts/HayyakumAllah/WOFF/${weight.file}.woff`}
                                                            download
                                                            className="inline-flex items-center gap-1.5 bg-[#428177] hover:bg-[#054239] text-white text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            <span>تحميل</span>
                                                        </a>
                                                    </div>
                                                ))}
                                            </TabsContent>
                                            {/* WOFF2 Tab */}
                                            <TabsContent value="woff2" className="space-y-2 mt-4">
                                                {HAYYAKUM_WEIGHTS.map((weight) => (
                                                    <div key={`woff2-${weight.file}`} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20">
                                                        <div>
                                                            <span className="font-medium text-sm block">{weight.nameAr}</span>
                                                            <span className="text-[11px] text-muted-foreground font-mono">{weight.file}.woff2</span>
                                                        </div>
                                                        <a
                                                            href={`/syid-assets/fonts/HayyakumAllah/WOFF2/${weight.file}.woff2`}
                                                            download
                                                            className="inline-flex items-center gap-1.5 bg-[#428177] hover:bg-[#054239] text-white text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            <span>تحميل</span>
                                                        </a>
                                                    </div>
                                                ))}
                                            </TabsContent>
                                        </Tabs>
                                    </DialogContent>
                                </Dialog>

                                {/* Preview Section (Loaded only on user click) */}
                                <div className="pt-3 border-t border-border/60">
                                    {!loadFontPreview ? (
                                        <Button
                                            variant="outline"
                                            onClick={() => setLoadFontPreview(true)}
                                            className="w-full text-xs font-medium h-9 border-dashed border-border hover:border-[#428177] flex items-center justify-center gap-2"
                                        >
                                            <Eye className="h-3.5 w-3.5 text-[#428177]" />
                                            <span>تحميل المعاينة ومقارنة الخط</span>
                                        </Button>
                                    ) : (
                                        <div className="space-y-3 bg-muted/30 p-3.5 rounded-xl border border-border animate-in fade-in-50 duration-300">
                                            {/* Rendered Font Text */}
                                            <div className="p-3 bg-background rounded-lg border border-border text-center">
                                                <span className="text-[11px] text-muted-foreground block mb-1">بخط حيّاكم الله:</span>
                                                <p className="text-xl sm:text-2xl tracking-wide py-2 font-normal" style={{ fontFamily: "'HayyakumAllah', sans-serif" }}>
                                                    الهوية البصرية السورية
                                                </p>
                                            </div>

                                            {/* Official Logo Image */}
                                            <div className="p-3 bg-background rounded-lg border border-border text-center">
                                                <span className="text-[11px] text-muted-foreground block mb-1">الشعار الرسمي (صورة):</span>
                                                <div className="flex justify-center items-center py-2">
                                                    <img
                                                        src="/syid-assets/materials/Syrian_logotype_darkgreen.svg"
                                                        alt="الهوية البصرية السورية - الشعار الرسمي"
                                                        className="h-11 sm:h-14 w-auto dark:hidden object-contain"
                                                    />
                                                    <img
                                                        src="/syid-assets/materials/Syrian_logotype_off-white.svg"
                                                        alt="الهوية البصرية السورية - الشعار الرسمي"
                                                        className="h-11 sm:h-14 w-auto hidden dark:block object-contain"
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    )}


                                </div>

                            </div>
                        </Card>
                    </div>
                </section>

                {/* 3. FLAG & PROPORTIONS */}
                <section>
                    <h2 className="text-2xl font-bold mb-6">العلم السوري ونسبه</h2>

                    <Card className="border border-border/80 rounded-xl overflow-hidden">
                        <CardContent className="p-6 overflow-x-auto">
                            {/* Diagram CSS retained */}
                            <div className="flag-diagram-wrapper my-2">
                                <div className="flag-diagram-container">
                                    <div className="flag-visual">
                                        <div className="stripe green"></div>
                                        <div className="stripe white">
                                            <svg className="star" viewBox="0 0 100 95"><path d="M50,0 L61.2,36.2 L100,36.2 L69.1,58.8 L79.4,95 L50,72.5 L20.6,95 L30.9,58.8 L0,36.2 L38.8,36.2 Z" fill="#ce1126" /></svg>
                                            <svg className="star" viewBox="0 0 100 95"><path d="M50,0 L61.2,36.2 L100,36.2 L69.1,58.8 L79.4,95 L50,72.5 L20.6,95 L30.9,58.8 L0,36.2 L38.8,36.2 Z" fill="#ce1126" /></svg>
                                            <svg className="star" viewBox="0 0 100 95"><path d="M50,0 L61.2,36.2 L100,36.2 L69.1,58.8 L79.4,95 L50,72.5 L20.6,95 L30.9,58.8 L0,36.2 L38.8,36.2 Z" fill="#ce1126" /></svg>
                                        </div>
                                        <div className="stripe black"></div>
                                    </div>

                                    {/* Top Measurements */}
                                    <div className="dim-line h-line top-line-h"></div>
                                    <div className="measurement top-total-num">36</div>
                                    <div className="dim-line v-line top-line-v-1"></div>
                                    <div className="dim-line v-line top-line-v-2"></div>
                                    <div className="dim-line v-line top-line-v-3"></div>
                                    <div className="dim-line v-line top-line-v-4"></div>
                                    <div className="dim-line v-line top-line-v-5"></div>
                                    <div className="measurement top-num-1">9</div>
                                    <div className="measurement top-num-2">9</div>
                                    <div className="measurement top-num-3">9</div>
                                    <div className="measurement top-num-4">9</div>

                                    {/* Right Measurements */}
                                    <div className="dim-line v-line right-line-v"></div>
                                    <div className="measurement right-total-num">24</div>
                                    <div className="dim-line h-line right-line-h-1"></div>
                                    <div className="dim-line h-line right-line-h-2"></div>
                                    <div className="dim-line h-line right-line-h-3"></div>
                                    <div className="dim-line h-line right-line-h-4"></div>
                                    <div className="measurement right-num-1">8</div>
                                    <div className="measurement right-num-2">8</div>
                                    <div className="measurement right-num-3">8</div>

                                    {/* Bottom Measurements */}
                                    <div className="dim-line h-line bottom-line-h"></div>
                                    <div className="dim-line v-line bottom-line-v-1"></div>
                                    <div className="dim-line v-line bottom-line-v-2"></div>
                                    <div className="dim-line v-line bottom-line-v-3"></div>
                                    <div className="dim-line v-line bottom-line-v-4"></div>
                                    <div className="dim-line v-line bottom-line-v-5"></div>
                                    <div className="dim-line v-line bottom-line-v-6"></div>
                                    <div className="measurement bottom-num-1">6</div>
                                    <div className="measurement bottom-num-2">6</div>
                                    <div className="measurement bottom-num-3">3</div>
                                    <div className="measurement bottom-num-4">6</div>
                                    <div className="measurement bottom-num-5">3</div>
                                    <div className="measurement bottom-num-6">6</div>
                                    <div className="measurement bottom-num-7">6</div>

                                    {/* Left Measurements */}
                                    <div className="dim-line v-line left-line-v"></div>
                                    <div className="measurement left-num-1">6</div>
                                    <div className="dim-line h-line left-line-h-1"></div>
                                    <div className="dim-line h-line left-line-h-2"></div>
                                </div>
                            </div>
                        </CardContent>

                        <div className="p-4 bg-muted/20 border-t border-border/40 flex flex-wrap justify-center gap-3">
                            <a
                                href="/syid-assets/materials/العلم السوري بالنسب الصحيحة.png"
                                download
                                className="inline-flex items-center gap-2 bg-[#428177] hover:bg-[#054239] text-white text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span>PNG</span>
                            </a>
                            <a
                                href="/syid-assets/materials/العلم السوري بالنسب الصحيحة.svg"
                                download
                                className="inline-flex items-center gap-2 bg-[#428177] hover:bg-[#054239] text-white text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <FileDown className="h-3.5 w-3.5" />
                                <span>SVG</span>
                            </a>
                            <a
                                href="/syid-assets/materials/علم سوريا.dwg"
                                download
                                className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" />
                                <span>DWG</span>
                            </a>
                        </div>
                    </Card>
                </section>

                {/* 4. GUIDELINES & MATERIALS */}
                <section>
                    <h2 className="text-2xl font-bold mb-6">المواد والدليل الإرشادي</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        {/* Guideline Manual */}
                        <Card className="border border-border/80 rounded-xl p-6 flex flex-col justify-between space-y-4">
                            <div>
                                <h3 className="font-bold text-lg mb-1">الدليل الإرشادي للعلم السوري</h3>
                                <p className="text-xs text-muted-foreground">
                                    إعداد ومساهمة:{" "}
                                    <a
                                        href="https://x.com/abd_hmh"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-foreground hover:text-[#428177] underline"
                                    >
                                        عبدالرحمن حداد (@abd_hmh)
                                    </a>
                                </p>
                            </div>

                            <div className="flex justify-center">
                                <img
                                    src="/syid-assets/materials/الدليل الإرشادي للعلم السوري.webp"
                                    alt="الدليل الإرشادي للعلم السوري"
                                    loading="lazy"
                                    className="max-h-44 w-auto rounded-md border border-border object-contain"
                                />
                            </div>

                            <a
                                href="https://drive.google.com/uc?export=download&id=1-HbfWI2PC76TTR6rKpmGl7GDcUlcZFXl"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 w-full bg-[#428177] hover:bg-[#054239] text-white font-medium text-sm h-10 rounded-lg transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                <span>تحميل الدليل (PDF)</span>
                            </a>
                        </Card>

                        {/* Logo Materials Package */}
                        <Card className="border border-border/80 rounded-xl p-6 flex flex-col justify-between space-y-4">
                            <div>
                                <h3 className="font-bold text-lg mb-1">شعار الهوية والمواد الرسمية</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                                    الموقع الرسمي متوقف عن العمل حالياً، وتم حفظ ورفع كافّة المواد هنا للتنزيل المباشر.
                                </p>
                            </div>

                            <div className="flex justify-center items-center py-4">
                                <img
                                    src="/syid-assets/materials/logo.ai.svg"
                                    alt="شعار الهوية"
                                    loading="lazy"
                                    className="max-h-28 w-auto object-contain"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <a
                                    href="/syid-assets/materials/logo.ai.svg"
                                    download="شعار_الهوية_البصرية_السورية.svg"
                                    className="inline-flex items-center justify-center gap-2 flex-1 bg-[#428177] hover:bg-[#054239] text-white font-medium text-xs h-10 px-3 rounded-lg transition-colors"
                                >
                                    <FileDown className="h-4 w-4" />
                                    <span>تحميل الشعار (SVG)</span>
                                </a>
                                <a
                                    href="https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/downloads/191b8f0d278fc2ab095fb4f344e3e9b4-vGF1L1.zip"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border font-medium text-xs h-10 px-3 rounded-lg transition-colors"
                                >
                                    <Download className="h-4 w-4" />
                                    <span>تحميل الحزمة (ZIP)</span>
                                </a>
                            </div>
                        </Card>
                    </div>

                    {/* Official Logotype SVG Theme Variants */}
                    <div className="mt-8">
                        <div className="mb-4">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Palette className="h-4 w-4 text-[#428177]" />
                                <span>مخطوطة الشعار بألوان وثيمات الهوية</span>
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                الملفات الرسمية لمخطوطة &quot;الجمهورية العربية السورية&quot; بصيغة SVG مهيأة لمختلف الأنماط والـ Themes.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {LOGOTYPE_THEME_VARIANTS.map((variant) => (
                                <Card key={variant.id} className="border border-border/80 rounded-xl overflow-hidden p-4 flex flex-col justify-between space-y-4">
                                    <div>
                                        <span className="font-bold text-sm block mb-1">{variant.nameAr}</span>
                                        <p className="text-[11px] text-muted-foreground leading-snug">{variant.description}</p>
                                    </div>

                                    <div className={`p-4 rounded-lg flex items-center justify-center min-h-[90px] ${variant.bgClass}`}>
                                        <img
                                            src={`/syid-assets/materials/${variant.file}`}
                                            alt={variant.nameAr}
                                            loading="lazy"
                                            className="max-h-12 w-auto object-contain"
                                        />
                                    </div>

                                    <a
                                        href={`/syid-assets/materials/${variant.file}`}
                                        download={variant.file}
                                        className="inline-flex items-center justify-center gap-2 w-full bg-[#428177] hover:bg-[#054239] text-white text-xs font-medium h-9 rounded-lg transition-colors"
                                    >
                                        <FileDown className="h-3.5 w-3.5" />
                                        <span>تحميل SVG</span>
                                    </a>
                                </Card>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 5. GOVERNORATE ICONS */}
                <section>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">أيقونات المحافظات السورية</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                إعداد وتصميم:{" "}
                                <a
                                    href="https://x.com/walaa_akdesign"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-foreground hover:text-[#428177] underline"
                                >
                                    ولاء (@walaa_akdesign)
                                </a>
                            </p>
                        </div>

                        <a
                            href="https://drive.google.com/drive/folders/1rRpQ98QKB_hnTofuN7zTVdk0YpH73CLL"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 bg-[#428177] hover:bg-[#054239] text-white font-medium text-xs h-10 px-5 rounded-lg transition-colors shadow-xs shrink-0"
                        >
                            <Download className="h-4 w-4" />
                            <span>تحميل الحزمة الكاملة (Google Drive)</span>
                            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                        </a>
                    </div>

                    {/* Theme Switcher Toggle for SVG Posters */}
                    <div className="mb-6 bg-muted/30 p-2 rounded-xl border border-border flex flex-wrap items-center justify-center gap-2">
                        {POSTER_THEMES.map((theme) => {
                            const isActive = activePosterTheme === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    onClick={() => setActivePosterTheme(theme.id)}
                                    className={`inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-background text-foreground shadow-xs border border-border font-bold ring-1 ring-[#428177]/40'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                                    }`}
                                >
                                    <span
                                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                                        style={{ backgroundColor: theme.primary }}
                                    />
                                    <span>{theme.name}</span>
                                </button>
                            );
                        })}
                    </div>


                    {/* Pure SVG Posters Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 items-center justify-items-center">
                        {GOVERNORATE_ICONS.map((icon) => {
                            const rawSvg = svgContents[icon.file];
                            const currentTheme = POSTER_THEMES.find(t => t.id === activePosterTheme) || POSTER_THEMES[0];
                            const recoloredSvg = rawSvg ? recolorSvg(rawSvg, currentTheme.primary, currentTheme.bg) : null;

                            const handleDownload = () => {
                                if (!recoloredSvg) return;
                                const blob = new Blob([recoloredSvg], { type: 'image/svg+xml' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `أيقونة_${icon.name}_${currentTheme.name}.svg`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                URL.revokeObjectURL(url);
                                setNotification(`تم تنزيل أيقونة ${icon.name} - ${currentTheme.name}`);
                                setTimeout(() => setNotification(null), 3000);
                            };

                            return (
                                <button
                                    key={icon.name}
                                    type="button"
                                    onClick={handleDownload}
                                    title={`انقر لتنزيل أيقونة ${icon.name} (${icon.landmark}) - ${currentTheme.name} Theme`}
                                    style={{ backgroundColor: currentTheme.bg }}
                                    className="w-full aspect-[312/436] flex items-center justify-center transition-transform hover:scale-[1.06] focus:outline-none cursor-pointer group p-1.5 rounded-xl border border-border/40 overflow-hidden shadow-2xs"
                                >
                                    {recoloredSvg ? (
                                        <div
                                            className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>svg]:object-contain drop-shadow-xs"
                                            dangerouslySetInnerHTML={{ __html: recoloredSvg }}
                                        />
                                    ) : (
                                        <img
                                            src={`/syid-assets/icons/governorates/with-frame/${encodeURIComponent(icon.file)}`}
                                            alt={`أيقونة ${icon.name}`}
                                            className="w-full h-full object-contain"
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>

                </section>


                {/* 6. SYRIA MAP (LAZY LOADED ON CLICK) */}
                <section>

                    <h2 className="text-2xl font-bold mb-6">خريطة سوريا الرقمية</h2>

                    <Card className="border border-border/80 rounded-xl overflow-hidden">
                        {mapLoaded ? (
                            <>
                                <div className="p-4 bg-muted/20 border-b border-border/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
                                    <div className="w-full sm:w-72">
                                        <Select onValueChange={setSelectedGov} value={selectedGov}>
                                            <SelectTrigger className="w-full bg-background border border-border h-10 rounded-lg text-sm">
                                                <SelectValue placeholder="اختر المحافظة..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-popover border border-border shadow-md rounded-lg">
                                                <div className="p-2 sticky top-0 bg-popover border-b border-border mb-1">
                                                    <div className="relative">
                                                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            placeholder="بحث..."
                                                            value={govSearch}
                                                            onChange={(e) => setGovSearch(e.target.value)}
                                                            className="h-7 pr-8 text-xs border-none bg-muted/40"
                                                            onKeyDown={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                                <SelectItem value="full">🇸🇾 سوريا كاملة</SelectItem>
                                                {filteredGovernorates.map((gov: any) => (
                                                    <SelectItem key={gov.id} value={gov.id}>
                                                        {gov.nameAr}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <Button
                                            onClick={handleExportSVG}
                                            className="flex-1 sm:flex-none h-10 px-4 bg-[#428177] hover:bg-[#054239] text-white text-xs font-medium rounded-lg"
                                        >
                                            <FileDown className="ml-1.5 h-3.5 w-3.5" />
                                            تصدير SVG
                                        </Button>
                                        <Button
                                            onClick={handleExportGeoJSON}
                                            variant="outline"
                                            className="flex-1 sm:flex-none h-10 px-4 text-xs font-medium rounded-lg"
                                        >
                                            <Download className="ml-1.5 h-3.5 w-3.5" />
                                            تصدير GeoJSON
                                        </Button>
                                    </div>
                                </div>

                                <CardContent className="p-4">
                                    <div className="h-[460px] w-full rounded-lg overflow-hidden border border-border relative">
                                        <Suspense fallback={
                                            <div className="h-full w-full flex items-center justify-center bg-muted/30 text-xs text-muted-foreground">
                                                جاري تحميل الخريطة...
                                            </div>
                                        }>
                                            <SyriaMap geoJsonData={geoJsonData} selectedGovId={selectedGov} />
                                        </Suspense>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <a
                                            href="https://pub-1d51b625c56e4fd085c58a79672e1b15.r2.dev/downloads/syria_provinces.geojson"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="font-medium">تحميل GeoJSON بدقة كاملة (R2)</span>
                                            <FileDown className="h-3.5 w-3.5 text-[#428177]" />
                                        </a>

                                        <a
                                            href="https://upload.wikimedia.org/wikipedia/commons/8/88/Blank_Syria_map.svg"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="font-medium">خريطة سوريا صماء (Wikimedia)</span>
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                        </a>

                                        <a
                                            href="https://upload.wikimedia.org/wikipedia/commons/2/2d/Syria_physical_location_map.svg"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="font-medium">خريطة تضاريس سوريا (Wikimedia)</span>
                                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                        </a>
                                    </div>
                                </CardContent>
                            </>
                        ) : (
                            <CardContent className="p-8">
                                <div className="h-[380px] w-full rounded-xl bg-muted/20 border border-dashed border-border flex flex-col items-center justify-center p-6 text-center space-y-4">
                                    <div className="p-3.5 rounded-full bg-[#428177]/10 text-[#428177]">
                                        <MapIcon className="h-8 w-8" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-base text-foreground mb-1">خريطة سوريا التفاعلية (GeoJSON)</h3>
                                        <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                                            انقر لتحميل بيانات الخريطة وعرض تضاريس المحافظات السورية وتصديرها بصيغ SVG و GeoJSON.
                                        </p>
                                    </div>
                                    <Button
                                        onClick={loadMapData}
                                        disabled={loadingMap}
                                        className="bg-[#428177] hover:bg-[#054239] text-white font-medium text-xs h-10 px-6 rounded-lg transition-all shadow-xs"
                                    >
                                        {loadingMap ? (
                                            <span>جاري تحميل البيانات...</span>
                                        ) : (
                                            <>
                                                <MapIcon className="ml-2 h-4 w-4" />
                                                <span>تحميل وتفعيل الخريطة</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </section>

            </main>

            {/* Notification Toast */}
            {notification && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-[#054239] text-white px-4 py-2.5 rounded-lg shadow-xl z-50 flex items-center gap-2 text-xs font-medium">
                    <Check className="h-3.5 w-3.5 text-green-400" />
                    <span>{notification}</span>
                </div>
            )}

            {/* Simple Footer */}
            <footer className="border-t border-border py-8 mt-16 text-center text-xs text-muted-foreground bg-muted/10">
                <p>&copy; 2025 syrian.zone • التطوير بواسطة هادي الأحمد</p>
                <div className="mt-2 flex justify-center gap-4">
                    <a href="http://hadealahmad.com/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">الموقع الشخصي</a>
                    <span>•</span>
                    <a href="https://x.com/hadealahmad" target="_blank" rel="noopener noreferrer" className="hover:text-foreground">حساب X</a>
                </div>
            </footer>
        </div>
    );
}
