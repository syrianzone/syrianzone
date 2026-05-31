"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Download, Copy, Check, ExternalLink, Map as MapIcon, FileDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { featureToSVG, getGovernorateNameAr } from '@/lib/geo-utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const SyriaMap = React.lazy(() => import('./SyriaMap'));

interface SyidClientProps {
}

// Color palettes from the official Syrian identity
const COLOR_PALETTES = [
    {
        name: 'Forest',
        colors: [
            { hex: '#428177', cmyk: 'C76% M32% Y54% K10%', textColor: 'white' },
            { hex: '#054239', cmyk: 'C89% M49% Y70% K50%', textColor: 'white' },
            { hex: '#002623', cmyk: 'C87% M59% Y68% K71%', textColor: 'white' },
        ]
    },
    {
        name: 'Golden Wheat',
        colors: [
            { hex: '#edebe0', cmyk: 'C6% M9% Y19% K0%', textColor: 'black' },
            { hex: '#b9a779', cmyk: 'C20% M29% Y52% K7%', textColor: 'black' },
            { hex: '#988561', cmyk: 'C39% M46% Y67% K20%', textColor: 'white' },
        ]
    },
    {
        name: 'Deep Umber',
        colors: [
            { hex: '#6b1f2a', cmyk: 'C35% M92% Y72% K46%', textColor: 'white' },
            { hex: '#4a151e', cmyk: 'C44% M86% Y68% K65%', textColor: 'white' },
            { hex: '#260f14', cmyk: 'C60% M75% Y64% K79%', textColor: 'white' },
        ]
    },
    {
        name: 'Charcoal',
        colors: [
            { hex: '#ffffff', cmyk: 'C0% M0% Y0% K0%', textColor: 'black' },
            { hex: '#3d3a3b', cmyk: 'C67% M53% Y60% K50%', textColor: 'white' },
            { hex: '#161616', cmyk: 'C73% M67% Y65% K80%', textColor: 'white' },
        ]
    },
];

export default function SyidClient() {
    const [copiedColor, setCopiedColor] = useState<string | null>(null);
    const [notification, setNotification] = useState<string | null>(null);
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [selectedGov, setSelectedGov] = useState<string>("full");
    const [govSearch, setGovSearch] = useState("");



    useEffect(() => {
        fetch('/assets/population/syria_provinces.geojson')
            .then(res => res.json())
            .then(data => setGeoJsonData(data))
            .catch(err => console.error('Failed to load GeoJSON', err));
    }, []);

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

    const handleExportSVG = () => {
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

        setNotification(`تم تحميل الملف بنجاح`);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleExportGeoJSON = () => {
        if (!geoJsonData) return;

        let dataToExport = geoJsonData;
        let filename = "syria_provinces.geojson";

        if (selectedGov !== "full") {
            const feature = geoJsonData.features.find((f: any) => f.properties.province_name === selectedGov);
            if (!feature) return;

            dataToExport = {
                type: "FeatureCollection",
                features: [feature]
            };
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

        setNotification(`تم تحميل الملف بنجاح`);
        setTimeout(() => setNotification(null), 3000);
    };

    const copyToClipboard = (text: string, colorHex: string) => {
        navigator.clipboard.writeText(text);
        setCopiedColor(colorHex);
        setNotification(`تم نسخ ${text}`);
        setTimeout(() => {
            setCopiedColor(null);
            setNotification(null);
        }, 2000);
    };

    return (
        <div className="min-h-screen transition-colors" dir="rtl">

            {/* Hero Section */}
            <section className="bg-card py-8 border-b border-border shadow-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">عناصر الهوية البصرية السورية</h1>
                        <p className="text-xl text-muted-foreground mb-8">
                            المواد المرتبطة بالهوية البصرية السورية - مجموعة غير رسمية ومجمّعة من أماكن متعددة بانتظار الإصدار الرسمي للهوية
                        </p>
                        <a
                            href="https://syrianidentity.sy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center whitespace-nowrap text-sm font-bold bg-[#428177] text-white hover:bg-[#054239] h-12 px-8 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg"
                        >
                            <ExternalLink className="ml-2 h-4 w-4" />
                            زيارة الموقع الرسمي للهوية البصرية السورية
                        </a>
                    </div>
                </div>
            </section>

            {/* Main Container */}
            <div className="container mx-auto my-8 max-w-7xl px-4 sm:px-6">
                <Card className="overflow-hidden border border-border shadow-xl rounded-2xl bg-card">

                    {/* Color Palette Section */}
                    <div className="p-10" id="colors">
                        <h2 className="text-4xl font-bold text-center text-foreground mb-4">لوحة الألوان</h2>
                        <p className="text-center text-lg mb-8 text-muted-foreground">يمكنك النقر على اللون لنسخ الرمز مباشرةً</p>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {COLOR_PALETTES.map((palette) => (
                                <div key={palette.name} className="mb-5">
                                    <div className="text-2xl font-semibold mb-2 text-center text-foreground">{palette.name}</div>
                                    <div className="flex overflow-hidden shadow-md border border-border rounded-xl">
                                        {palette.colors.map((color) => (
                                            <div
                                                key={color.hex}
                                                className="flex-1 p-5 min-h-[140px] flex items-end cursor-pointer transition-all duration-200 ease-in-out hover:scale-105"
                                                style={{
                                                    backgroundColor: color.hex,
                                                    color: color.textColor
                                                }}
                                                onClick={() => copyToClipboard(color.hex, color.hex)}
                                            >
                                                <div className="color-text">
                                                    <div className="font-mono text-sm font-bold mb-1">{color.hex}</div>
                                                    <div className="text-xs opacity-80 whitespace-pre-line">{color.cmyk.replace(/ /g, '\n')}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Typography / Font Section */}
                    <div className="p-10 border-t border-border" id="typography">
                        <h2 className="text-4xl font-bold text-center text-foreground mb-4">الخطوط</h2>
                        <p className="text-center text-lg mb-8 text-muted-foreground">احصل على خط قمرة المستخدم في الهوية البصرية السورية</p>

                        <div className="text-center mb-8">
                            <img
                                src="/syid-assets/materials/qomra2.webp"
                                alt="خط قمرة"
                                className="mx-auto max-w-full h-auto shadow-lg border-4 border-border rounded-xl"
                                style={{ maxHeight: '300px' }}
                            />
                        </div>

                        <div className="text-center">
                            <a
                                href="https://iwantype.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center bg-[#428177] text-white font-bold h-12 px-8 rounded-xl no-underline transition-all hover:bg-[#054239] hover:-translate-y-0.5 hover:shadow-lg"
                            >
                                <ExternalLink className="ml-2 h-5 w-5" />
                                شراء الخطوط من iWantype
                            </a>
                            <p className="mt-4 text-muted-foreground">
                                استخدم كود الخصم <span className="font-semibold text-foreground">syrianzone</span> للخصم 25% على خط قمرة المستخدم في الهوية البصرية السورية
                            </p>
                        </div>
                    </div>

                    {/* Flag Proportions Section */}
                    <div className="p-10 border-t border-border" id="flag">
                        <h2 className="text-4xl font-bold text-center text-foreground mb-4">العلم السوري ونسبه</h2>
                        <p className="text-center text-lg mb-8 text-muted-foreground">النسب الدقيقة لتصميم العلم السوري الرسمي، كما هو موضح في المخطط أدناه.</p>

                        <div className="flag-diagram-wrapper">
                            <div className="flag-diagram-container">
                                {/* Flag Visual */}
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

                        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
                            <a
                                href="/syid-assets/materials/العلم السوري بالنسب الصحيحة.png"
                                download
                                className="inline-flex items-center justify-center bg-[#428177] text-white font-bold h-12 px-8 rounded-xl transition-all hover:bg-[#054239] hover:-translate-y-0.5 hover:shadow-lg text-center"
                            >
                                <Download className="ml-2 h-5 w-5" />
                                تحميل PNG
                            </a>
                            <a
                                href="/syid-assets/materials/العلم السوري بالنسب الصحيحة.svg"
                                download
                                className="inline-flex items-center justify-center bg-[#428177] text-white font-bold h-12 px-8 rounded-xl transition-all hover:bg-[#054239] hover:-translate-y-0.5 hover:shadow-lg text-center"
                            >
                                <FileDown className="ml-2 h-5 w-5" />
                                تحميل SVG
                            </a>
                            <a
                                href="/syid-assets/materials/علم سوريا.dwg"
                                download
                                className="inline-flex items-center justify-center bg-secondary text-secondary-foreground font-bold h-12 px-8 rounded-xl transition-all hover:bg-secondary/80 border-2 border-border hover:-translate-y-0.5 hover:shadow-lg text-center"
                            >
                                <Download className="ml-2 h-5 w-5" />
                                تحميل DWG
                            </a>
                        </div>
                    </div>

                    {/* Materials Section */}
                    <div className="p-10 border-t border-border" id="materials">
                        <h2 className="text-4xl font-bold text-center text-foreground mb-4">المواد والموارد</h2>
                        <p className="text-center text-lg mb-8 text-muted-foreground">تحميل المواد الرسمية والموارد المرئية للهوية البصرية السورية الجديدة.</p>

                        <div className="text-center mb-8">
                            <img
                                src="/syid-assets/materials/logo.ai.svg"
                                alt="شعار الهوية البصرية السورية"
                                className="mx-auto max-w-full h-auto shadow-lg border-4 border-border rounded-xl"
                                style={{ maxHeight: '200px' }}
                            />
                        </div>

                        <div className="text-center">
                            <a
                                href="/syid-assets/materials/191b8f0d278fc2ab095fb4f344e3e9b4.zip"
                                download
                                className="inline-flex items-center justify-center bg-[#428177] text-white font-bold h-12 px-8 rounded-xl no-underline transition-all hover:bg-[#054239] hover:-translate-y-0.5 hover:shadow-lg"
                            >
                                <Download className="ml-2 h-5 w-5" />
                                تحميل المواد والموارد الرسمية
                            </a>
                        </div>
                    </div>


                    {/* Syria Map Section */}
                    <div className="p-10 border-t border-border" id="map">
                        <h2 className="text-4xl font-bold text-center text-foreground mb-4">خريطة سوريا</h2>
                        <p className="text-center text-lg mb-8 text-muted-foreground">عرض وتحميل الخرائط الرسمية للجمهورية العربية السورية بصيغ مختلفة وبدقة عالية.</p>

                        <div className="max-w-4xl mx-auto mb-8">
                            <div className="flex flex-col md:flex-row gap-4 mb-6">
                                <div className="flex-1">
                                    <Select onValueChange={setSelectedGov} value={selectedGov}>
                                        <SelectTrigger className="w-full bg-muted border-2 border-border h-12 rounded-xl">
                                            <SelectValue placeholder="اختر المحافظة..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-[#1A1F22] border-2 border-border shadow-2xl z-[1001] opacity-100 rounded-2xl">
                                            <div className="p-2 sticky top-0 bg-white dark:bg-[#1A1F22] z-[1002] border-b border-border mb-1">
                                                <div className="relative">
                                                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        placeholder="بحث عن محافظة..."
                                                        value={govSearch}
                                                        onChange={(e) => setGovSearch(e.target.value)}
                                                        className="h-9 pr-9 bg-muted/50 border-none focus-visible:ring-1 focus-visible:ring-[#428177]"
                                                        onKeyDown={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>
                                            <SelectItem value="full">سوريا كاملة</SelectItem>
                                            {filteredGovernorates.map((gov: any) => (
                                                <SelectItem key={gov.id} value={gov.id}>
                                                    {gov.nameAr}
                                                </SelectItem>
                                            ))}
                                            {filteredGovernorates.length === 0 && govSearch && (
                                                <div className="py-6 text-center text-sm text-muted-foreground">
                                                    لا توجد نتائج للبحث
                                                </div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleExportSVG}
                                        className="h-12 px-6 bg-[#428177] hover:bg-[#054239] transition-all rounded-xl"
                                    >
                                        <FileDown className="ml-2 h-5 w-5" />
                                        تحميل SVG
                                    </Button>
                                    <Button
                                        onClick={handleExportGeoJSON}
                                        className="h-12 px-6 bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-border transition-all rounded-xl"
                                    >
                                        <Download className="ml-2 h-5 w-5" />
                                        تحميل GeoJSON
                                    </Button>
                                </div>
                            </div>

                            <div className="h-[500px] w-full mb-8 rounded-2xl overflow-hidden border-2 border-border shadow-inner">
                                <Suspense fallback={<div className="h-[400px] w-full flex items-center justify-center bg-muted text-muted-foreground rounded-xl border-2 border-dashed border-border">جاري تحميل الخريطة...</div>}>
                                    <SyriaMap geoJsonData={geoJsonData} selectedGovId={selectedGov} />
                                </Suspense>
                            </div>

                            <div className="mt-12 pt-8 border-t border-border">
                                <h3 className="text-2xl font-bold mb-6 text-foreground flex items-center gap-2">
                                    <ExternalLink className="h-6 w-6 text-[#428177]" />
                                    مصادر أخرى
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <a
                                        href="https://upload.wikimedia.org/wikipedia/commons/8/88/Blank_Syria_map.svg"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center p-4 rounded-xl bg-muted border border-border hover:bg-accent transition-colors group"
                                    >
                                        <div className="ml-4 p-2 rounded-full bg-white group-hover:bg-[#428177]/10 transition-colors">
                                            <MapIcon className="h-6 w-6 text-[#428177]" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-foreground">خريطة سوريا (صماء)</div>
                                            <div className="text-sm text-muted-foreground">صيغة SVG من ويكيميديا كومنز</div>
                                        </div>
                                        <Download className="h-5 w-5 text-muted-foreground group-hover:text-[#428177] transition-colors" />
                                    </a>
                                    <a
                                        href="https://upload.wikimedia.org/wikipedia/commons/2/2d/Syria_physical_location_map.svg"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center p-4 rounded-xl bg-muted border border-border hover:bg-accent transition-colors group"
                                    >
                                        <div className="ml-4 p-2 rounded-full bg-white group-hover:bg-[#428177]/10 transition-colors">
                                            <MapIcon className="h-6 w-6 text-[#428177]" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-foreground">خريطة جغرافية</div>
                                            <div className="text-sm text-muted-foreground">صيغة SVG تضاريس سوريا</div>
                                        </div>
                                        <Download className="h-5 w-5 text-muted-foreground group-hover:text-[#428177] transition-colors" />
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                </Card>
            </div>

            {/* Notification */}
            {notification && (
                <div className="fixed bottom-5 left-1/2 transform -translate-x-1/2 bg-[#428177] text-white px-6 py-4 shadow-lg z-50">
                    {notification}
                </div>
            )}

            {/* Footer */}
            <footer className="bg-card border-t border-border py-6 mt-12 transition-colors">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-foreground">&copy; 2025 syrian.zone</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                        تم التطوير بواسطة <span className="font-semibold">هادي الأحمد</span>
                    </p>
                    <div className="mt-2 flex justify-center gap-4">
                        <a href="http://hadealahmad.com/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-[#428177] transition-colors flex items-center">
                            الموقع الشخصي
                        </a>
                        <a href="https://x.com/hadealahmad" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-[#428177] transition-colors flex items-center">
                            حساب X
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
