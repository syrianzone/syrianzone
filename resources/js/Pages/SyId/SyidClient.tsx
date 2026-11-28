import React, { useState, useMemo, Suspense, useEffect } from 'react';
import { Link } from '@inertiajs/react';
import {
    ArrowLeft, Download, Copy, Check, ExternalLink, Map as MapIcon, FileDown, Tag, Eye
} from 'lucide-react';
import { Button } from "@/Components/ui/button";
import { PageBody, PageHeader } from "@/Components/layout";
import { notify } from '@/Lib/notify';
import { copyText } from '@/Lib/copy';
import { MEDIA_BASE } from '@/Domain/govapps/media';
import { SYID_FACTS, type SyidFacts } from '@/Domain/syid/facts';
import { FlagProportionsDiagram } from './_components/FlagProportionsDiagram';
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
import { featureToSVG } from './featureToSVG';
import { GOVERNORATES, getGovernorateNameAr } from '@/Domain/geography/governorates';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/Components/ui/select";

const SyriaMap = React.lazy(() => import('./SyriaMap'));

const HAYYAKUM_WEIGHTS = [
    { nameAr: 'خفيف (Light)', file: 'HayyakumAllah-Light', weightLabel: '300' },
    { nameAr: 'عادي (Regular)', file: 'HayyakumAllah-Regular', weightLabel: '400' },
    { nameAr: 'متوسط (Medium)', file: 'HayyakumAllah-Medium', weightLabel: '500' },
    { nameAr: 'عريض (Bold)', file: 'HayyakumAllah-Bold', weightLabel: '700' },
];



// Landmark artwork per governorate, in the shared table's display order.
const GOVERNORATE_ARTWORK: Record<string, { landmark: string; file: string }> = {
    damascus: { landmark: 'السيف الدمشقي', file: 'damascus-sword.svg' },
    'rural-damascus': { landmark: 'غوطة ريف دمشق', file: 'rif-dimashq-ghouta.svg' },
    aleppo: { landmark: 'قلعة حلب', file: 'aleppo-citadel.svg' },
    homs: { landmark: 'ساعة حمص', file: 'homs-clock.svg' },
    hama: { landmark: 'نواعير حماة', file: 'hama-norias.svg' },
    latakia: { landmark: 'قوس النصر', file: 'latakia-triumph-arch.svg' },
    tartus: { landmark: 'جزيرة أرواد', file: 'tartous-arwad.svg' },
    idlib: { landmark: 'رويحة إدلب', file: 'idlib-ruweiha.svg' },
    'deir-ez-zor': { landmark: 'الجسر المعلق', file: 'deir-ez-zor-bridge.svg' },
    raqqa: { landmark: 'بوابة بغداد', file: 'raqqa-baghdad-gate.svg' },
    hasakah: { landmark: 'جسر عين ديوار', file: 'hasakah-ain-diwar.svg' },
    daraa: { landmark: 'المسجد العمري', file: 'daraa-omari-mosque.svg' },
    sweida: { landmark: 'قنوات السويداء', file: 'sweida-qanawat.svg' },
    quneitra: { landmark: 'بيت صيدا', file: 'quneitra-beit-saida.svg' },
};

const GOVERNORATE_ICONS = GOVERNORATES.flatMap((governorate) => {
    const artwork = GOVERNORATE_ARTWORK[governorate.id];
    return artwork ? [{ name: governorate.nameAr, ...artwork }] : [];
});

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

interface SyidClientProps {
    syid?: SyidFacts;
}

export default function SyidClient({ syid }: SyidClientProps) {
    const facts = syid ?? SYID_FACTS;
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [geoJsonData, setGeoJsonData] = useState<any>(null);
    const [selectedGov, setSelectedGov] = useState<string>("full");
    const [mapLoaded, setMapLoaded] = useState(false);
    const [loadingMap, setLoadingMap] = useState(false);
    const [loadFontPreview, setLoadFontPreview] = useState(false);
    const [activePosterTheme, setActivePosterTheme] = useState<string>('default');
    const [svgContents, setSvgContents] = useState<Record<string, string>>({});

    useEffect(() => {
        const loadSvgs = async () => {
            const loaded: Record<string, string> = {};
            let failed = 0;
            await Promise.all(
                GOVERNORATE_ICONS.map(async (icon) => {
                    try {
                        const res = await fetch(`/syid-assets/icons/governorates/with-frame/${encodeURIComponent(icon.file)}`);
                        // A 404 page or proxy error is not artwork: fall back to the static <img>.
                        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('svg')) {
                            throw new Error(`icon ${icon.file}: ${res.status}`);
                        }
                        const text = await res.text();
                        loaded[icon.file] = text;
                    } catch {
                        failed += 1;
                    }
                })
            );
            setSvgContents(loaded);
            // The icons are the poster's artwork: a failed load draws a hole in it,
            // which the visitor only notices after downloading.
            if (failed > 0) {
                notify.error(`تعذّر تحميل ${failed} من أيقونات المحافظات، وسيظهر الشعار ناقصاً`);
            }
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
            notify.error('تعذر تحميل بيانات الخريطة');
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
        // Revoking in the same task can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        notify.success(`تم تحميل ملف SVG بنجاح`);
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
        // Revoking in the same task can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        notify.success(`تم تحميل ملف GeoJSON بنجاح`);
    };

    const copyToClipboard = async (text: string, key: string) => {
        const copied = await copyText(text, { successMessage: `تم النسخ: ${text}` });
        if (!copied) return;
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors" dir="rtl">
            <PageBody className="space-y-12">
                <PageHeader
                    title="عناصر الهوية البصرية السورية"
                    description="دليل متكامل ومجمّع للمواد الرقمية والملفات المتصلة بالهوية البصرية السورية — الشعار، العلم، الألوان، الخطوط، وأيقونات المحافظات."
                    divider
                    actions={
                        <Button asChild variant="outline" size="sm" className="h-9 gap-1.5">
                            <a
                                href="https://syrianidentity.sy"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <span>الموقع الرسمي</span>
                                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                            </a>
                        </Button>
                    }
                />

                <section aria-labelledby="syid-hub-links-heading">
                    <h2 id="syid-hub-links-heading" className="sr-only">صفحات الشعار والعلم المخصّصة</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Link
                            href="/syid/logo"
                            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors shadow-2xs"
                        >
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 p-2.5">
                                <img
                                    src={facts.logo.hero_image.path}
                                    alt={facts.logo.hero_image.alt_ar}
                                    width={80}
                                    height={80}
                                    className="h-full w-full object-contain"
                                />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                    شعار الجمهورية العربية السورية (العقاب الذهبي)
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                    تحميل الشعار بصيغ SVG وPNG بدقة 4K وPDF بالنسخ الذهبية والأحادية مع دلالاته الرسمية.
                                </p>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden="true" />
                        </Link>

                        <Link
                            href="/syid/flag"
                            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors shadow-2xs"
                        >
                            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/30 p-2 overflow-hidden">
                                <img
                                    src={facts.flag.hero_image.path}
                                    alt={facts.flag.hero_image.alt_ar}
                                    width={96}
                                    height={64}
                                    className="h-full w-full object-contain rounded-sm"
                                />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <h3 className="text-base sm:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                                    علم سوريا الجديد — النسخ والتحميل والنسب
                                </h3>
                                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                                    نسخ إيموجي العلم 🇸🇾، تحميل الصور بدقة 4K وSVG، النسب الهندسية 2:3، الألوان، والخلفيات.
                                </p>
                            </div>
                            <ArrowLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" aria-hidden="true" />
                        </Link>
                    </div>

                    {/* Many visitors searching «هوية سورية» want the personal ID card,
                        not the visual identity: point them to the promise that tracks it. */}
                    <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                        تبحث عن البطاقة الشخصية (الهوية) الجديدة؟ هذه الصفحة عن الهوية البصرية للدولة.{' '}
                        <Link
                            href="/promises/40"
                            className="font-medium text-primary underline underline-offset-4 hover:no-underline"
                        >
                            موعد بدء التسجيل على البطاقة الشخصية الجديدة
                        </Link>
                    </p>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-6">لوحة الألوان</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {facts.palettes.map((palette) => (
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
                                                    <button
                                                        onClick={() => copyToClipboard(color.hex, hexKey)}
                                                        className="flex items-center justify-between w-full font-mono text-xs font-bold p-1 rounded bg-black/20 hover:bg-black/30 transition-colors"
                                                    >
                                                        <span>{color.hex}</span>
                                                        {copiedKey === hexKey ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3 opacity-70" />}
                                                    </button>

                                                    <div dir="ltr" className="space-y-1 text-[10px] font-mono mt-2">
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

                <section>
                    <h2 className="text-2xl font-bold mb-6">الخطوط</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                        <Tag className="h-3.5 w-3.5 text-primary" />
                                        <span>كود الخصم (25%):</span>
                                        <code className="font-mono font-bold text-foreground">syrianzone</code>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => copyToClipboard('syrianzone', 'discount')}
                                        aria-label="نسخ كود الخصم"
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
                                className="inline-flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm h-10 rounded-lg transition-colors mt-6"
                            >
                                <span>شراء الخطوط من iWantype</span>
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Card>

                        <Card className="border border-border/80 rounded-xl overflow-hidden flex flex-col justify-between p-6">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-lg font-bold">خط حيّاكم الله</h3>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        خط مجاني قريب من خط قمرة المدفوع المعتمد في الهوية البصرية السورية
                                    </p>
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    تأتي بأربعة أوزان مختلفة (Light, Regular, Medium, Bold) لتناسب مختلف أغراض التصميم.
                                </p>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm h-10 rounded-lg flex items-center justify-center gap-2">
                                            <Download className="h-4 w-4" />
                                            <span>تحميل خط حيّاكم الله</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent dir="rtl" className="max-w-md text-start sm:rounded-xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-lg font-bold text-start">تحميل خط حيّاكم الله</DialogTitle>
                                            <DialogDescription className="text-xs text-muted-foreground text-start">
                                                اختر الصيغة المناسبة لتنزيل الأوزان المتوفرة (Light, Regular, Medium, Bold).
                                            </DialogDescription>
                                        </DialogHeader>

                                        <Tabs defaultValue="ttf" className="w-full mt-2" dir="rtl">
                                            <TabsList className="grid grid-cols-3 w-full">
                                                <TabsTrigger value="ttf">TTF</TabsTrigger>
                                                <TabsTrigger value="woff">WOFF</TabsTrigger>
                                                <TabsTrigger value="woff2">WOFF2</TabsTrigger>
                                            </TabsList>
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
                                                            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            <span>تحميل</span>
                                                        </a>
                                                    </div>
                                                ))}
                                            </TabsContent>
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
                                                            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
                                                        >
                                                            <Download className="h-3.5 w-3.5" />
                                                            <span>تحميل</span>
                                                        </a>
                                                    </div>
                                                ))}
                                            </TabsContent>
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
                                                            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs px-3 py-1.5 rounded-md transition-colors font-medium"
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

                                <div className="pt-3 border-t border-border/60">
                                    {!loadFontPreview ? (
                                        <Button
                                            variant="outline"
                                            onClick={() => setLoadFontPreview(true)}
                                            className="w-full text-xs font-medium h-9 border-dashed border-border hover:border-primary flex items-center justify-center gap-2"
                                        >
                                            <Eye className="h-3.5 w-3.5 text-primary" />
                                            <span>تحميل المعاينة ومقارنة الخط</span>
                                        </Button>
                                    ) : (
                                        <div className="space-y-4 pt-1 animate-in fade-in-50 duration-300">
                                            <div>
                                                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">بخط حيّاكم الله:</span>
                                                <div className="w-full flex items-center justify-center py-1">
                                                    <svg viewBox="0 0 320 48" className="w-full h-auto max-h-16 overflow-visible">
                                                        <text
                                                            x="50%"
                                                            y="55%"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            fill="currentColor"
                                                            style={{ fontFamily: "'HayyakumAllah', sans-serif" }}
                                                            className="text-[36px] font-normal text-foreground"
                                                        >
                                                            الهوية البصرية السورية
                                                        </text>
                                                    </svg>
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[11px] font-semibold text-muted-foreground block mb-1">بخط قمرة:</span>
                                                <div className="flex justify-center items-center py-1">
                                                    <img
                                                        src="/syid-assets/materials/blackonwhite.png"
                                                        alt="الهوية البصرية السورية - بخط قمرة"
                                                        className="h-12 sm:h-16 w-auto dark:hidden object-contain"
                                                    />
                                                    <img
                                                        src="/syid-assets/materials/whiteonblack.png"
                                                        alt="الهوية البصرية السورية - بخط قمرة"
                                                        className="h-12 sm:h-16 w-auto hidden dark:block object-contain"
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

                <section>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                        <h2 className="text-2xl font-bold">العلم السوري ونسبه</h2>
                        <Link
                            href="/syid/flag"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline underline-offset-4"
                        >
                            <span>صفحة العلم الكاملة (نسخ 🇸🇾 والتحميل بدقة 4K)</span>
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>

                    <Card className="border border-border/80 rounded-xl overflow-hidden">
                        <CardContent className="p-6 overflow-x-auto">
                            <FlagProportionsDiagram ariaLabel={facts.flag.specs.diagram_aria_label_ar} />
                        </CardContent>

                        <div className="p-4 bg-muted/20 border-t border-border/40 flex flex-wrap justify-center gap-3">
                            <a
                                href="/syid-assets/downloads/syrian-flag-3840.png"
                                download="علم-سوريا-الجديد-4K-3840.png"
                                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>PNG 4K</span>
                            </a>
                            <a
                                href="/syid-assets/downloads/syrian-flag.svg"
                                download="علم-سوريا-الجديد.svg"
                                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>SVG نظيف</span>
                            </a>
                            <a
                                href="/syid-assets/materials/syrian-flag-proportions.png"
                                download
                                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>PNG</span>
                            </a>
                            <a
                                href="/syid-assets/materials/syrian-flag-proportions.svg"
                                download
                                className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>SVG</span>
                            </a>
                            <a
                                href="/syid-assets/materials/syrian-flag.dwg"
                                download
                                className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border text-xs font-medium h-9 px-4 rounded-lg transition-colors"
                            >
                                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>DWG</span>
                            </a>
                        </div>
                    </Card>
                </section>

                <section>
                    <h2 className="text-2xl font-bold mb-6">المواد والدليل الإرشادي</h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <Card className="border border-border/80 rounded-xl p-6 flex flex-col justify-between space-y-4">
                            <div>
                                <h3 className="font-bold text-lg mb-1">الدليل الإرشادي للعلم السوري</h3>
                                <p className="text-xs text-muted-foreground">
                                    إعداد ومساهمة:{" "}
                                    <a
                                        href="https://x.com/abd_hmh"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-foreground hover:text-primary underline"
                                    >
                                        عبدالرحمن حداد (@abd_hmh)
                                    </a>
                                </p>
                            </div>

                            <div className="flex justify-center">
                                <img
                                    src="/syid-assets/materials/syrian-flag-guide.webp"
                                    alt="الدليل الإرشادي للعلم السوري"
                                    loading="lazy"
                                    className="max-h-44 w-auto rounded-md border border-border object-contain"
                                />
                            </div>

                            <a
                                href="https://drive.google.com/uc?export=download&id=1-HbfWI2PC76TTR6rKpmGl7GDcUlcZFXl"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-sm h-10 rounded-lg transition-colors"
                            >
                                <Download className="h-4 w-4" />
                                <span>تحميل الدليل (PDF)</span>
                            </a>
                        </Card>

                        <Card className="border border-border/80 rounded-xl p-6 flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <h3 className="font-bold text-lg">شعار الهوية والمواد الرسمية</h3>
                                    <Link
                                        href="/syid/logo"
                                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline underline-offset-4"
                                    >
                                        <span>صفحة الشعار الكاملة</span>
                                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <a
                                    href="/syid-assets/materials/logo.ai.svg"
                                    download="شعار_الهوية_البصرية_السورية.svg"
                                    className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-10 px-3 rounded-lg transition-colors"
                                >
                                    <FileDown className="h-4 w-4" aria-hidden="true" />
                                    <span>تحميل الشعار (SVG)</span>
                                </a>
                                <a
                                    href="/syid-assets/downloads/syrian-arab-republic-eagle-emblem-4k.png"
                                    download="شعار-الجمهورية-العربية-السورية-4K.png"
                                    className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-10 px-3 rounded-lg transition-colors"
                                >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                    <span>تحميل PNG 4K</span>
                                </a>
                                <a
                                    href="/syid-assets/downloads/syrian-arab-republic-eagle-emblem.pdf"
                                    download="شعار-الجمهورية-العربية-السورية.pdf"
                                    className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border font-medium text-xs h-10 px-3 rounded-lg transition-colors"
                                >
                                    <FileDown className="h-4 w-4" aria-hidden="true" />
                                    <span>تحميل PDF متّجه</span>
                                </a>
                                <a
                                    href={`${MEDIA_BASE}/downloads/191b8f0d278fc2ab095fb4f344e3e9b4-vGF1L1.zip`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border font-medium text-xs h-10 px-3 rounded-lg transition-colors"
                                >
                                    <Download className="h-4 w-4" aria-hidden="true" />
                                    <span>تحميل الحزمة (ZIP)</span>
                                </a>
                            </div>
                        </Card>
                    </div>

                </section>

                <section>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 className="text-2xl font-bold">أيقونات المحافظات السورية</h2>
                            <p className="text-xs text-muted-foreground mt-1">
                                إعداد وتصميم:{" "}
                                <span className="font-medium text-foreground">ولاء</span>{" "}
                                (<a
                                    href="https://x.com/walaa_akdesign"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-foreground hover:text-primary underline"
                                >
                                    X / Twitter
                                </a>
                                {" • "}
                                <a
                                    href="https://www.instagram.com/walaa_akdesign/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-foreground hover:text-primary underline"
                                >
                                    Instagram
                                </a>)
                            </p>
                        </div>

                        <a
                            href="https://drive.google.com/drive/folders/1rRpQ98QKB_hnTofuN7zTVdk0YpH73CLL"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-10 px-5 rounded-lg transition-colors shadow-xs shrink-0"
                        >
                            <Download className="h-4 w-4" />
                            <span>تحميل الحزمة الكاملة (Google Drive)</span>
                            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
                        </a>
                    </div>

                    <div className="mb-6 bg-muted/30 p-2 rounded-xl border border-border flex flex-wrap items-center justify-center gap-2">
                        {POSTER_THEMES.map((theme) => {
                            const isActive = activePosterTheme === theme.id;
                            return (
                                <button
                                    key={theme.id}
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={() => setActivePosterTheme(theme.id)}
                                    className={`inline-flex items-center gap-2 text-xs px-3.5 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-background text-foreground shadow-xs border border-border font-bold ring-1 ring-primary/40'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                                    }`}
                                >
                                    <span
                                        aria-hidden="true"
                                        className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                                        style={{ backgroundColor: theme.primary }}
                                    />
                                    <span>{theme.name}</span>
                                </button>
                            );
                        })}
                    </div>


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
                                // Revoking in the same task can cancel the download in some browsers.
                                setTimeout(() => URL.revokeObjectURL(url), 1000);
                                notify.success(`تم تنزيل أيقونة ${icon.name} - ${currentTheme.name}`);
                            };

                            return (
                                <button aria-label={`انقر لتنزيل أيقونة ${icon.name} (${icon.landmark}) - ${currentTheme.name} Theme`}
                                    key={icon.name}
                                    type="button"
                                    onClick={handleDownload}
                                    title={`انقر لتنزيل أيقونة ${icon.name} (${icon.landmark}) - ${currentTheme.name} Theme`}
                                    style={{ backgroundColor: currentTheme.bg }}
                                    className="w-full aspect-[312/436] flex items-center justify-center transition-transform hover:scale-[1.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background cursor-pointer group p-1.5 rounded-xl border border-border/40 overflow-hidden shadow-2xs"
                                >
                                    {recoloredSvg ? (
                                        // An image, not inline markup: each SVG keeps its own
                                        // .st0-.st4 classes and ids instead of sharing the page's.
                                        <img
                                            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(recoloredSvg)}`}
                                            alt=""
                                            className="w-full h-full object-contain drop-shadow-xs"
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


                <section>

                    <h2 className="text-2xl font-bold mb-6">خريطة سوريا الرقمية</h2>

                    <Card className="border border-border/80 rounded-xl overflow-hidden">
                        {mapLoaded ? (
                            <>
                                <div className="p-4 bg-muted/20 border-b border-border/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
                                    <div className="w-full sm:w-72">
                                        <Select onValueChange={setSelectedGov} value={selectedGov}>
                                            <SelectTrigger className="w-full bg-background border border-border h-10 rounded-lg text-sm" aria-label="اختر المحافظة...">
                                                <SelectValue placeholder="اختر المحافظة..." />
                                            </SelectTrigger>
                                            <SelectContent className="bg-popover border border-border shadow-md rounded-lg">
                                                {/* 14 items: Select's own type-ahead finds one; a text
                                                    input inside a listbox is not reachable as one. */}
                                                <SelectItem value="full">سوريا كاملة</SelectItem>
                                                {governorates.map((gov: any) => (
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
                                            className="flex-1 sm:flex-none h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium rounded-lg"
                                        >
                                            <FileDown className="me-1.5 h-3.5 w-3.5" />
                                            تصدير SVG
                                        </Button>
                                        <Button
                                            onClick={handleExportGeoJSON}
                                            variant="outline"
                                            className="flex-1 sm:flex-none h-10 px-4 text-xs font-medium rounded-lg"
                                        >
                                            <Download className="me-1.5 h-3.5 w-3.5" />
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
                                            <SyriaMap geoJsonData={geoJsonData} selectedGovId={selectedGov === 'full' ? null : selectedGov} />
                                        </Suspense>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-border/40 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                        <a
                                            href={`${MEDIA_BASE}/downloads/syria_provinces.geojson`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <span className="font-medium">تحميل GeoJSON بدقة كاملة (R2)</span>
                                            <FileDown className="h-3.5 w-3.5 text-primary" />
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
                                    <div className="p-3.5 rounded-full bg-primary/10 text-primary">
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
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs h-10 px-6 rounded-lg transition-all shadow-xs"
                                    >
                                        {loadingMap ? (
                                            <span>جاري تحميل البيانات...</span>
                                        ) : (
                                            <>
                                                <MapIcon className="me-2 h-4 w-4" />
                                                <span>تحميل وتفعيل الخريطة</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </section>

            </PageBody>

        </div>
    );
}
