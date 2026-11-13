import React, { useId } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/Components/ui/dialog";
import { Switch } from "@/Components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { MapPin } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/Components/ui/sheet";
import { isDeviceLocation, usesCustomCoordinates, useLocationPreference, type LocationPatch } from '@/Domain/location/preference';
import PrayerSettingsFields from '@/Domain/prayer/PrayerSettingsFields';
import { useIsMobile } from '@/Lib/useIsMobile';
import { GOVERNORATES, getGovernorateNameAr } from '@/Domain/geography/governorates';

interface HomeSettingsFields {
    eventsGovernorate: string;
    setEventsGovernorate: (gov: string) => void;
    showWeather: boolean;
    setShowWeather: (show: boolean) => void;
    showPrayerTimes: boolean;
    setShowPrayerTimes: (show: boolean) => void;
    showEvents: boolean;
    setShowEvents: (show: boolean) => void;
    /** Mirror a location edit to the account; device storage belongs to Domain/location. */
    onLocationChange: (patch: LocationPatch) => void;
    saveAccountSettings: (settings: Record<string, unknown>) => void;
}

interface HomeSettingsDialogProps extends HomeSettingsFields {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function HomeSettingsBody(props: HomeSettingsFields) {
    const {
    eventsGovernorate,
    setEventsGovernorate,
    showWeather,
    setShowWeather,
    showPrayerTimes,
    setShowPrayerTimes,
    showEvents,
    setShowEvents,
    onLocationChange,
    saveAccountSettings,
  } = props;
    // Saved location display (GPS/IP point, manual coordinates or governorate).
    const location = useLocationPreference();
    const geoActive = isDeviceLocation(location);
    const customActive = usesCustomCoordinates(location);
    const activeGovName = getGovernorateNameAr(location.city);
    // Ids for the visible toggle captions: Radix Switch renders a <button>, so
    // the caption names it through aria-labelledby rather than <Label htmlFor>.
    const weatherLabelId = useId();
    const prayerLabelId = useId();
    const eventsLabelId = useId();

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
                                    <span id={weatherLabelId} className="text-[11px] font-medium text-foreground">الطقس</span>
                                    <Switch
                                        aria-labelledby={weatherLabelId}
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
                                    <span id={prayerLabelId} className="text-[11px] font-medium text-foreground">الصلاة</span>
                                    <Switch
                                        aria-labelledby={prayerLabelId}
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
                                    <span id={eventsLabelId} className="text-[11px] font-medium text-foreground">الفعاليات</span>
                                    <Switch
                                        aria-labelledby={eventsLabelId}
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
                            <div className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-card/20 p-3">
                                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                                    <MapPin className="h-4 w-4" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-xs font-bold text-foreground">
                                        {geoActive && location.geo ? location.geo.label : activeGovName}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {geoActive
                                            ? (location.mode === 'gps' ? 'موقع الجهاز (GPS)' : 'التعرف عبر الإنترنت')
                                            : customActive && location.customLat && location.customLon
                                                ? `إحداثيات مخصصة (${location.customLat}، ${location.customLon})`
                                                : 'المحافظة الافتراضية'}
                                    </div>
                                </div>
                            </div>

                            <PrayerSettingsFields
                                cities={GOVERNORATES}
                                cityLabel="مدينة المواقيت والطقس"
                                cityLabelIcon={false}
                                showGeoLabel={false}
                                showEmptyCoordsHint
                                onLocationChange={onLocationChange}
                            />
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
                                    <SelectTrigger dir="rtl" aria-label="محافظة الفعاليات"><SelectValue /></SelectTrigger>
                                    <SelectContent dir="rtl">
                                        {GOVERNORATES.map((governorate) => (
                                            <SelectItem key={governorate.id} value={governorate.id}>{governorate.nameAr}</SelectItem>
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
                    <HomeSettingsBody {...props} />
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
                <HomeSettingsBody {...props} />
            </DialogContent>
        </Dialog>
    );
}
