import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Label } from "@/Components/ui/label";
import { Input } from "@/Components/ui/input";
import { Switch } from "@/Components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { MapPin } from 'lucide-react';
import LocationModeSelector from '@/Pages/Muslim/_components/LocationModeSelector';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/Components/ui/sheet";
import { getGeo, getLocMode, setLocMode, useLocSignal } from '@/Pages/Muslim/_lib/location';
import { useIsMobile } from '@/Pages/Muslim/_lib/nav';

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
    governorate: string;
    setGovernorate: (gov: string) => void;
    eventsGovernorate: string;
    setEventsGovernorate: (gov: string) => void;
    showWeather: boolean;
    setShowWeather: (show: boolean) => void;
    showPrayerTimes: boolean;
    setShowPrayerTimes: (show: boolean) => void;
    showEvents: boolean;
    setShowEvents: (show: boolean) => void;
    useCustomCoords: boolean;
    setUseCustomCoords: (use: boolean) => void;
    customLat: string;
    setCustomLat: (lat: string) => void;
    customLon: string;
    setCustomLon: (lon: string) => void;
    saveAccountSettings: (settings: Record<string, any>) => void;
}

function HomeSettingsBody(props: HomeSettingsDialogProps) {
    const { governorate,
    setGovernorate,
    eventsGovernorate,
    setEventsGovernorate,
    showWeather,
    setShowWeather,
    showPrayerTimes,
    setShowPrayerTimes,
    showEvents,
    setShowEvents,
    useCustomCoords,
    setUseCustomCoords,
    customLat,
    setCustomLat,
    customLon,
    setCustomLon,
    saveAccountSettings,
  } = props;
    // Saved location display (GPS/IP point or manual governorate).
    const locSig = useLocSignal();
    const locMode = getLocMode();
    const geo = getGeo();
    const geoActive = (locMode === 'gps' || locMode === 'ip') && !!geo;
    const customActive = locMode === 'custom' || useCustomCoords;
    const activeGovName = GOVERNORATE_LIST.find(g => g.value === governorate)?.nameAr ?? governorate;
    void locSig;

    // Mode radio doubles as the custom-coords switch (mutually exclusive).
    const selectMode = (m: 'city' | 'gps' | 'ip' | 'custom') => {
        setLocMode(m);
        const on = m === 'custom';
        if (on !== useCustomCoords) {
            setUseCustomCoords(on);
            try {
                localStorage.setItem('useCustomCoords', String(on));
            } catch {
                // private mode
            }
            saveAccountSettings({ useCustomCoords: on });
        }
    };

    return (
        <>
                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-6 sz-scroll touch-pan-y [-webkit-overflow-scrolling:touch]" dir="rtl" data-lenis-prevent>
                    <div className="space-y-6 py-4 text-start">
                        {/* Widget visibility toggles */}
                        <div className="space-y-4">
                            <h4 className="font-semibold text-foreground text-sm">
                                عرض وإخفاء الودجات
                            </h4>
                            <div className="grid grid-cols-3 gap-2">
                                {/* Toggle Weather */}
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-2 bg-card/20">
                                    <span className="text-[11px] font-medium text-foreground">الطقس</span>
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
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-2 bg-card/20">
                                    <span className="text-[11px] font-medium text-foreground">الصلاة</span>
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
                                <div className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-2 bg-card/20">
                                    <span className="text-[11px] font-medium text-foreground">الفعاليات</span>
                                    <Switch
                                        checked={showEvents}
                                        onCheckedChange={(checked) => {
                                            setShowEvents(checked);
                                            localStorage.setItem('sz-showEvents', String(checked));
                                            saveAccountSettings({ showEvents: checked });
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-[1px] bg-border w-full" />

                        {/* Prayer times & weather location */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-foreground text-sm">
                                    موقع مواقيت الصلاة والطقس
                                </h4>
                                <p className="text-xs text-muted-foreground leading-normal mt-1">
                                    حدد موقعك عبر GPS أو الإنترنت، أو أدخل إحداثياتك يدوياً — تُستخدم للمواقيت والطقس معاً.
                                </p>
                            </div>
                            <LocationModeSelector
                                mode={locMode}
                                onChange={selectMode}
                                cityHint="اختر مدينتها من القائمة أدناه"
                            />
                            <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/20 p-3">
                                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                                    <MapPin className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-bold text-foreground">
                                        {geoActive ? geo.label : activeGovName}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {geoActive
                                            ? (locMode === 'gps' ? 'موقع الجهاز (GPS)' : 'التعرف عبر الإنترنت')
                                            : customActive && customLat && customLon
                                                ? `إحداثيات مخصصة (${customLat}، ${customLon})`
                                                : 'المحافظة الافتراضية'}
                                    </div>
                                </div>
                            </div>

                            {locMode === 'city' && (
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold">مدينة المواقيت والطقس</Label>
                                    <Select value={governorate} onValueChange={(v) => {
                                        setGovernorate(v);
                                        localStorage.setItem('governorate', v);
                                        saveAccountSettings({ governorate: v });
                                    }}>
                                        <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                                        <SelectContent dir="rtl">
                                            {GOVERNORATE_LIST.map((g) => (
                                                <SelectItem key={g.value} value={g.value}>{g.nameAr}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {customActive && (
                                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-card/10 p-3">
                                    <div className="space-y-1 text-start">
                                        <Label className="text-xs">خط العرض (Lat)</Label>
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
                                        <Label className="text-xs">خط الطول (Lon)</Label>
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
                            )}

                            {customActive && customLat === '' && customLon === '' && (
                                <p className="text-[11px] text-muted-foreground">
                                    أدخل الإحداثيات يدوياً.
                                </p>
                            )}
                        </div>

                        <div className="h-[1px] bg-border w-full" />

                        {/* Events governorate */}
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-foreground text-sm">
                                    محافظة الفعاليات
                                </h4>
                                <p className="text-xs text-muted-foreground leading-normal mt-1">
                                    تُستخدم لعرض فعاليات محافظتك في الصفحة الرئيسية (وستغذي الروزنامة لاحقاً).
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Select value={eventsGovernorate} onValueChange={setEventsGovernorate}>
                                    <SelectTrigger dir="rtl"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {GOVERNORATE_LIST.map((g) => (
                                            <SelectItem key={g.value} value={g.value}>{g.nameAr}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                </div>
                </>
    );
}

export default function HomeSettingsDialog({
    open,
    onOpenChange,
    ...props
}: HomeSettingsDialogProps) {
    const isMobile = useIsMobile();
    if (isMobile) {
        return (
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent side="bottom" dir="rtl" className="flex max-h-[85dvh] flex-col rounded-t-3xl border-b-0 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    <SheetHeader className="shrink-0 text-right">
                        <SheetTitle>الإعدادات</SheetTitle>
                    </SheetHeader>
                    <HomeSettingsBody open={open} onOpenChange={onOpenChange} {...props} />
                </SheetContent>
            </Sheet>
        );
    }
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl md:max-w-3xl max-h-[85vh] flex flex-col p-0" dir="rtl">
                <DialogHeader className="px-6 pt-6 pb-2 text-start sm:text-start">
                    <DialogTitle>الإعدادات</DialogTitle>
                </DialogHeader>
                <HomeSettingsBody open={open} onOpenChange={onOpenChange} {...props} />
            </DialogContent>
        </Dialog>
    );
}
