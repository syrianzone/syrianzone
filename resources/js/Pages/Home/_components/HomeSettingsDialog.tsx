import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/Components/ui/tabs";
import { ScrollArea } from "@/Components/ui/scroll-area";
import { Label } from "@/Components/ui/label";
import { Input } from "@/Components/ui/input";
import { Button } from "@/Components/ui/button";
import { Switch } from "@/Components/ui/switch";
import { Search, Compass, Info, BarChart3, Shield, FileText } from 'lucide-react';
import { THEME_REGISTRY } from '@/lib/theme';
import { applyFont, FontPreference } from '@/Lib/font';

export const GOVERNORATE_LIST = [
    { value: "damascus", nameAr: "دمشق", nameEn: "Damascus" },
    { value: "aleppo", nameAr: "حلب", nameEn: "Aleppo" },
    { value: "homs", nameAr: "حمص", nameEn: "Homs" },
    { value: "hama", nameAr: "حماة", nameEn: "Hama" },
    { value: "latakia", nameAr: "اللاذقية", nameEn: "Latakia" },
    { value: "tartus", nameAr: "طرطوس", nameEn: "Tartus" },
    { value: "deir-ez-zor", nameAr: "دير الزور", nameEn: "Deir ez-Zor" },
    { value: "idlib", nameAr: "إدلب", nameEn: "Idlib" },
    { value: "daraa", nameAr: "درعا", nameEn: "Daraa" },
    { value: "quneitra", nameAr: "القنيطرة", nameEn: "Quneitra" },
    { value: "sweida", nameAr: "السويداء", nameEn: "Sweida" },
    { value: "rural-damascus", nameAr: "ريف دمشق", nameEn: "Rural Damascus" },
    { value: "hasakah", nameAr: "الحسكة", nameEn: "Hasakah" },
    { value: "raqqa", nameAr: "الرقة", nameEn: "Raqqa" },
];

export interface HomeSettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentLang: 'ar' | 'en';
    setLanguage: (lang: 'ar' | 'en') => void;
    clockFormat: '12' | '24';
    setClockFormat: (fmt: '12' | '24') => void;
    fontFamily: FontPreference;
    setFontFamily: (font: FontPreference) => void;
    governorate: string;
    setGovernorate: (gov: string) => void;
    activeTheme: string | null;
    applyTheme: (themeId: string) => void;
    showClock: boolean;
    setShowClock: (show: boolean) => void;
    showWeather: boolean;
    setShowWeather: (show: boolean) => void;
    showPrayerTimes: boolean;
    setShowPrayerTimes: (show: boolean) => void;
    showEvents: boolean;
    setShowEvents: (show: boolean) => void;
    showSearch: boolean;
    setShowSearch: (show: boolean) => void;
    useCustomCoords: boolean;
    setUseCustomCoords: (use: boolean) => void;
    customLat: string;
    setCustomLat: (lat: string) => void;
    customLon: string;
    setCustomLon: (lon: string) => void;
    getDeviceLocation: () => void;
    customSearchUrl: string;
    setCustomSearchUrl: (url: string) => void;
    saveAccountSettings: (settings: Record<string, any>) => void;
}

export default function HomeSettingsDialog({
    open,
    onOpenChange,
    currentLang,
    setLanguage,
    clockFormat,
    setClockFormat,
    fontFamily,
    setFontFamily,
    governorate,
    setGovernorate,
    activeTheme,
    applyTheme,
    showClock,
    setShowClock,
    showWeather,
    setShowWeather,
    showPrayerTimes,
    setShowPrayerTimes,
    showEvents,
    setShowEvents,
    showSearch,
    setShowSearch,
    useCustomCoords,
    setUseCustomCoords,
    customLat,
    setCustomLat,
    customLon,
    setCustomLon,
    getDeviceLocation,
    customSearchUrl,
    setCustomSearchUrl,
    saveAccountSettings,
}: HomeSettingsDialogProps) {
    const [govDropdownOpen, setGovDropdownOpen] = useState(false);
    const [govSearch, setGovSearch] = useState('');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col p-0" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                <DialogHeader className="px-6 pt-6 pb-2 text-start sm:text-start">
                    <DialogTitle>{currentLang === 'ar' ? 'الإعدادات' : 'Settings'}</DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="simple" dir={currentLang === 'ar' ? 'rtl' : 'ltr'} className="w-full flex-1 flex flex-col min-h-0">
                    <div className="px-6 border-b">
                        <TabsList className="w-full justify-start rounded-none border-b-0 bg-transparent p-0 h-10 gap-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                            <TabsTrigger
                                value="simple"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 pt-2 text-sm font-semibold cursor-pointer"
                            >
                                {currentLang === 'ar' ? 'عام' : 'General'}
                            </TabsTrigger>
                            <TabsTrigger
                                value="advanced"
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-1 pb-3 pt-2 text-sm font-semibold cursor-pointer"
                            >
                                {currentLang === 'ar' ? 'خيارات متقدمة' : 'Advanced'}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 min-h-0">
                        <TabsContent value="simple" className="h-full m-0">
                            <ScrollArea className="h-[450px] max-h-[50vh] px-6 pb-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                <div className="space-y-6 py-4 text-start">
                                    {/* Row with Language, Clock & Font segmented controls */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {/* Language Selection */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{currentLang === 'ar' ? 'اللغة' : 'Language'}</Label>
                                            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg border border-border/50">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLanguage('ar');
                                                        localStorage.setItem('sz-language', 'ar');
                                                        saveAccountSettings({ language: 'ar' });
                                                    }}
                                                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${currentLang === 'ar'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    العربية
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setLanguage('en');
                                                        localStorage.setItem('sz-language', 'en');
                                                        saveAccountSettings({ language: 'en' });
                                                    }}
                                                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${currentLang === 'en'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    English
                                                </button>
                                            </div>
                                        </div>

                                        {/* Time Format Selection */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{currentLang === 'ar' ? 'تنسيق الوقت' : 'Time Format'}</Label>
                                            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg border border-border/50">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setClockFormat('12');
                                                        localStorage.setItem('clockFormat', '12');
                                                        saveAccountSettings({ clockFormat: '12' });
                                                    }}
                                                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${clockFormat === '12'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    {currentLang === 'ar' ? '12 ساعة' : '12-Hour'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setClockFormat('24');
                                                        localStorage.setItem('clockFormat', '24');
                                                        saveAccountSettings({ clockFormat: '24' });
                                                    }}
                                                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${clockFormat === '24'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    {currentLang === 'ar' ? '24 ساعة' : '24-Hour'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Font Family Selection */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{currentLang === 'ar' ? 'خط الموقع' : 'Site Font'}</Label>
                                            <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-lg border border-border/50">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFontFamily('ibm-plex');
                                                        applyFont('ibm-plex');
                                                        saveAccountSettings({ fontFamily: 'ibm-plex' });
                                                    }}
                                                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${fontFamily === 'ibm-plex'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    {currentLang === 'ar' ? 'خطّ الموقع' : 'Site Font'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFontFamily('system');
                                                        applyFont('system');
                                                        saveAccountSettings({ fontFamily: 'system' });
                                                    }}
                                                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${fontFamily === 'system'
                                                            ? 'bg-background text-foreground shadow-sm'
                                                            : 'text-muted-foreground hover:text-foreground'
                                                        }`}
                                                >
                                                    {currentLang === 'ar' ? 'خط النظام' : 'System Font'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Governorate dropdown with search */}
                                    <div className="space-y-2 relative">
                                        <Label className="text-sm font-semibold">{currentLang === 'ar' ? 'المحافظة الافتراضية' : 'Default Governorate'}</Label>
                                        <button
                                            type="button"
                                            onClick={() => setGovDropdownOpen(!govDropdownOpen)}
                                            className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background/50 px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-start"
                                        >
                                            <span>
                                                {(() => {
                                                    const activeGov = GOVERNORATE_LIST.find(g => g.value === governorate);
                                                    return activeGov ? (currentLang === 'ar' ? `${activeGov.nameAr} / ${activeGov.nameEn}` : `${activeGov.nameEn} / ${activeGov.nameAr}`) : (currentLang === 'ar' ? 'اختر محافظة...' : 'Select governorate...');
                                                })()}
                                            </span>
                                            <span className="text-muted-foreground text-xs">▼</span>
                                        </button>

                                        {govDropdownOpen && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => { setGovDropdownOpen(false); setGovSearch(''); }} />
                                                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-80">
                                                    <div className="flex items-center border-b px-3">
                                                        <Search className="h-4 w-4 shrink-0 opacity-50 me-2" />
                                                        <input
                                                            type="text"
                                                            value={govSearch}
                                                            onChange={(e) => setGovSearch(e.target.value)}
                                                            placeholder={currentLang === 'ar' ? 'ابحث عن محافظة...' : 'Search governorate...'}
                                                            className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                                                        />
                                                    </div>
                                                    <div className="max-h-[200px] overflow-y-auto p-1">
                                                        {(() => {
                                                            const filtered = GOVERNORATE_LIST.filter(g =>
                                                                g.nameAr.includes(govSearch) ||
                                                                g.nameEn.toLowerCase().includes(govSearch.toLowerCase())
                                                            );

                                                            if (filtered.length === 0) {
                                                                return <div className="py-6 text-center text-sm text-muted-foreground">{currentLang === 'ar' ? 'لم يتم العثور على نتائج' : 'No results found.'}</div>;
                                                            }

                                                            return filtered.map((g) => {
                                                                const isSelected = g.value === governorate;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={g.value}
                                                                        onClick={() => {
                                                                            setGovernorate(g.value);
                                                                            localStorage.setItem('governorate', g.value);
                                                                            saveAccountSettings({ governorate: g.value });
                                                                            setGovDropdownOpen(false);
                                                                            setGovSearch('');
                                                                        }}
                                                                        className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer text-start ${isSelected ? 'bg-accent/50 font-semibold' : ''}`}
                                                                    >
                                                                        <span>{currentLang === 'ar' ? `${g.nameAr} / ${g.nameEn}` : `${g.nameEn} / ${g.nameAr}`}</span>
                                                                        {isSelected && <span className="text-primary text-xs">✓</span>}
                                                                    </button>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Theme Settings */}
                                    <div className="space-y-4 pt-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {currentLang === 'ar' ? 'إعدادات المظهر' : 'Theme Settings'}
                                        </h4>

                                        <div className="space-y-2">
                                            {/* Standard themes list */}
                                            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1">
                                                {currentLang === 'ar' ? 'المظاهر الأساسية' : 'Standard'}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {THEME_REGISTRY.filter(t => t.group === 'standard' || t.group === 'system').map((t) => {
                                                    const isActive = activeTheme === t.id;
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => applyTheme(t.id)}
                                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] focus:outline-none w-full border text-start"
                                                            style={{
                                                                background: isActive ? t.primary + '1a' : 'hsl(var(--muted))',
                                                                border: isActive ? `2px solid ${t.primary}` : '2px solid transparent',
                                                            }}
                                                        >
                                                            <div
                                                                className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden shadow-sm"
                                                                style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                                            >
                                                                <div style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                                            </div>
                                                            <span className="text-xs font-medium truncate" style={{ color: isActive ? t.primary : 'hsl(var(--foreground))' }}>
                                                                {t.emoji} {currentLang === 'ar' ? t.nameAr : t.nameEn}
                                                            </span>
                                                            {isActive && (
                                                                <span className="ms-auto text-xs" style={{ color: t.primary }}>✓</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Syrian Heritage themes list */}
                                            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-3">
                                                {currentLang === 'ar' ? 'التراث السوري' : 'Syrian Heritage'}
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {THEME_REGISTRY.filter(t => t.group === 'heritage').map((t) => {
                                                    const isActive = activeTheme === t.id;
                                                    return (
                                                        <button
                                                            key={t.id}
                                                            type="button"
                                                            onClick={() => applyTheme(t.id)}
                                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.01] focus:outline-none w-full border text-start"
                                                            style={{
                                                                background: isActive ? t.primary + '1a' : 'hsl(var(--muted))',
                                                                border: isActive ? `2px solid ${t.primary}` : '2px solid transparent',
                                                            }}
                                                        >
                                                            <div
                                                                className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden shadow-sm"
                                                                style={{ background: t.bg, border: `2px solid ${t.primary}` }}
                                                            >
                                                                <div style={{ background: t.primary, height: '50%', marginTop: '50%' }} />
                                                            </div>
                                                            <span className="text-xs font-medium truncate" style={{ color: isActive ? t.primary : 'hsl(var(--foreground))' }}>
                                                                {t.emoji} {currentLang === 'ar' ? t.nameAr : t.nameEn}
                                                            </span>
                                                            {isActive && (
                                                                <span className="ms-auto text-xs" style={{ color: t.primary }}>✓</span>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="advanced" className="h-full m-0">
                            <ScrollArea className="h-[450px] max-h-[50vh] px-6 pb-6" dir={currentLang === 'ar' ? 'rtl' : 'ltr'}>
                                <div className="space-y-6 py-4 text-start">
                                    {/* Widget visibility toggles */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {currentLang === 'ar' ? 'عرض وإخفاء الودجات' : 'Widget Visibility'}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* Toggle Clock */}
                                            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'الساعة' : 'Clock'}</span>
                                                <Switch
                                                    checked={showClock}
                                                    onCheckedChange={(checked) => {
                                                        setShowClock(checked);
                                                        localStorage.setItem('sz-showClock', String(checked));
                                                        saveAccountSettings({ showClock: checked });
                                                    }}
                                                />
                                            </div>
                                            {/* Toggle Weather */}
                                            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'الطقس' : 'Weather'}</span>
                                                <Switch
                                                    checked={showWeather}
                                                    onCheckedChange={(checked) => {
                                                        setShowWeather(checked);
                                                        localStorage.setItem('sz-showWeather', String(checked));
                                                        saveAccountSettings({ showWeather: checked });
                                                    }}
                                                />
                                            </div>
                                            {/* Toggle Prayer Times */}
                                            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'مواقيت الصلاة' : 'Prayer Times'}</span>
                                                <Switch
                                                    checked={showPrayerTimes}
                                                    onCheckedChange={(checked) => {
                                                        setShowPrayerTimes(checked);
                                                        localStorage.setItem('sz-showPrayerTimes', String(checked));
                                                        saveAccountSettings({ showPrayerTimes: checked });
                                                    }}
                                                />
                                            </div>
                                            {/* Toggle Events */}
                                            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                                <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'الفعاليات والأحداث' : 'Events Widget'}</span>
                                                <Switch
                                                    checked={showEvents}
                                                    onCheckedChange={(checked) => {
                                                        setShowEvents(checked);
                                                        localStorage.setItem('sz-showEvents', String(checked));
                                                        saveAccountSettings({ showEvents: checked });
                                                    }}
                                                />
                                            </div>
                                            {/* Toggle Search */}
                                            <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20 flex-1 col-span-1 sm:col-span-2">
                                                <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'شريط البحث' : 'Search Bar'}</span>
                                                <Switch
                                                    checked={showSearch}
                                                    onCheckedChange={(checked) => {
                                                        setShowSearch(checked);
                                                        localStorage.setItem('sz-showSearch', String(checked));
                                                        saveAccountSettings({ showSearch: checked });
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="h-[1px] bg-border w-full" />

                                    {/* Custom Coordinates Section */}
                                    <div className="space-y-4 pt-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {currentLang === 'ar' ? 'إحداثيات جغرافية مخصصة' : 'Custom Location Coordinates'}
                                        </h4>
                                        <p className="text-xs text-muted-foreground leading-normal">
                                            {currentLang === 'ar'
                                                ? 'استخدم إحداثيات مخصصة بدلاً من موقع المحافظة الافتراضي لجلب الطقس ومواقيت الصلاة بشكل دقيق للغاية.'
                                                : 'Set custom GPS coordinates to fetch local weather and prayer times with high precision.'}
                                        </p>

                                        <div className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-card/20">
                                            <span className="text-xs font-medium text-foreground">{currentLang === 'ar' ? 'تفعيل الإحداثيات المخصصة' : 'Use Custom Coordinates'}</span>
                                            <Switch
                                                checked={useCustomCoords}
                                                onCheckedChange={(checked) => {
                                                    setUseCustomCoords(checked);
                                                    localStorage.setItem('useCustomCoords', String(checked));
                                                    saveAccountSettings({ useCustomCoords: checked });
                                                }}
                                            />
                                        </div>

                                        {useCustomCoords && (
                                            <div className="space-y-3 p-3 rounded-lg border border-border bg-card/10">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1 text-start">
                                                        <Label className="text-xs">{currentLang === 'ar' ? 'خط العرض (Lat)' : 'Latitude'}</Label>
                                                        <Input
                                                            type="text"
                                                            value={customLat}
                                                            onChange={(e) => {
                                                                setCustomLat(e.target.value);
                                                                localStorage.setItem('customLat', e.target.value);
                                                                saveAccountSettings({ customLat: e.target.value });
                                                            }}
                                                            placeholder="33.5138"
                                                        />
                                                    </div>
                                                    <div className="space-y-1 text-start">
                                                        <Label className="text-xs">{currentLang === 'ar' ? 'خط الطول (Lon)' : 'Longitude'}</Label>
                                                        <Input
                                                            type="text"
                                                            value={customLon}
                                                            onChange={(e) => {
                                                                setCustomLon(e.target.value);
                                                                localStorage.setItem('customLon', e.target.value);
                                                                saveAccountSettings({ customLon: e.target.value });
                                                            }}
                                                            placeholder="36.2765"
                                                        />
                                                    </div>
                                                </div>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full text-xs cursor-pointer flex items-center justify-center gap-1.5"
                                                    onClick={getDeviceLocation}
                                                >
                                                    <Compass className="w-3.5 h-3.5" />
                                                    {currentLang === 'ar' ? 'الحصول على إحداثيات موقعي الحالي' : 'Get coordinates from device'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="h-[1px] bg-border w-full" />

                                    {/* Custom Search Engine Section */}
                                    <div className="space-y-4 pt-2">
                                        <h4 className="font-semibold text-foreground text-sm">
                                            {currentLang === 'ar' ? 'محرك بحث مخصص' : 'Custom Search Engine'}
                                        </h4>
                                        <p className="text-xs text-muted-foreground leading-normal">
                                            {currentLang === 'ar'
                                                ? 'إذا اخترت محرك البحث "مخصص" من الصفحة الرئيسية، سيتم استخدام هذا الرابط. ضع %s في مكان كلمة البحث (مثال: https://search.yahoo.com/search?q=%s).'
                                                : 'If "Custom" is selected as the search provider on the homepage, queries will be sent to this URL. Use %s to specify where the query should be injected (e.g. https://search.yahoo.com/search?q=%s).'}
                                        </p>
                                        <div className="space-y-1 text-start">
                                            <Label className="text-xs">{currentLang === 'ar' ? 'رابط محرك البحث المخصص' : 'Custom Search Query URL'}</Label>
                                            <Input
                                                type="text"
                                                value={customSearchUrl}
                                                onChange={(e) => {
                                                    setCustomSearchUrl(e.target.value);
                                                    localStorage.setItem('customSearchUrl', e.target.value);
                                                }}
                                                placeholder="https://search.yahoo.com/search?q=%s"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="border-t bg-muted/20 p-4">
                    <div className="flex flex-wrap justify-center gap-3 sm:gap-4 text-xs text-muted-foreground">
                        <a href="/about" className="hover:text-primary transition-colors flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                            {currentLang === 'ar' ? 'عن المنصة' : 'About'}
                        </a>
                        <span>•</span>
                        <a href="/stats" className="hover:text-primary transition-colors flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                            {currentLang === 'ar' ? 'الإحصائيات' : 'Statistics'}
                        </a>
                        <span>•</span>
                        <a href="/privacy" className="hover:text-primary transition-colors flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                            {currentLang === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
                        </a>
                        <span>•</span>
                        <a href="/terms" className="hover:text-primary transition-colors flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
                            {currentLang === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
                        </a>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
