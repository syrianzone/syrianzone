import React, { useId } from 'react';
import { Switch } from "@/Components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { MapPin } from 'lucide-react';
import { isDeviceLocation, usesCustomCoordinates, useLocationPreference, type LocationPatch } from '@/Domain/location/preference';
import PrayerSettingsFields from '@/Domain/prayer/PrayerSettingsFields';
import ResponsiveSettingsDialog from '@/Domain/prayer/ResponsiveSettingsDialog';
import { GOVERNORATES, getGovernorateNameAr } from '@/Domain/geography/governorates';
import type { HomeDisplayPrefs, HomeToggleKey } from '../_lib/homePrefs';

interface HomeSettingsFields {
    eventsGovernorate: string;
    onEventsGovernorateChange: (gov: string) => void;
    displayPrefs: HomeDisplayPrefs;
    onToggleChange: (key: HomeToggleKey, value: boolean) => void;
    /** Mirror a location edit to the account; device storage belongs to Domain/location. */
    onLocationChange: (patch: LocationPatch) => void;
}

interface HomeSettingsDialogProps extends HomeSettingsFields {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function HomeSettingsBody(props: HomeSettingsFields) {
    const { eventsGovernorate, onEventsGovernorateChange, displayPrefs, onToggleChange, onLocationChange } = props;
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
        <div className="space-y-6 py-4 text-start">
            <div className="space-y-4">
                <h3 className="font-semibold text-foreground text-sm">
                    عرض وإخفاء الودجات
                </h3>
                <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-2 bg-card/20">
                        <span id={weatherLabelId} className="text-[11px] font-medium text-foreground">الطقس</span>
                        <Switch
                            aria-labelledby={weatherLabelId}
                            checked={displayPrefs.showWeather}
                            onCheckedChange={(checked) => onToggleChange('showWeather', checked)}
                        />
                    </div>
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-2 bg-card/20">
                        <span id={prayerLabelId} className="text-[11px] font-medium text-foreground">الصلاة</span>
                        <Switch
                            aria-labelledby={prayerLabelId}
                            checked={displayPrefs.showPrayerTimes}
                            onCheckedChange={(checked) => onToggleChange('showPrayerTimes', checked)}
                        />
                    </div>
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border/50 p-2 bg-card/20">
                        <span id={eventsLabelId} className="text-[11px] font-medium text-foreground">الفعاليات</span>
                        <Switch
                            aria-labelledby={eventsLabelId}
                            checked={displayPrefs.showEvents}
                            onCheckedChange={(checked) => onToggleChange('showEvents', checked)}
                        />
                    </div>
                </div>
            </div>

            <div className="h-[1px] bg-border w-full" />

            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-foreground text-sm">
                        موقع مواقيت الصلاة والطقس
                    </h3>
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

            <div className="space-y-4">
                <div>
                    <h3 className="font-semibold text-foreground text-sm">
                        محافظة الفعاليات
                    </h3>
                    <p className="text-xs text-muted-foreground leading-normal mt-1">
                        تُستخدم لعرض فعاليات محافظتك في الصفحة الرئيسية (وستغذي الروزنامة لاحقاً).
                    </p>
                </div>
                <div className="space-y-2">
                    <Select value={eventsGovernorate} onValueChange={onEventsGovernorateChange}>
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
    );
}

export default function HomeSettingsDialog({
    open,
    onOpenChange,
    ...props
}: HomeSettingsDialogProps) {
    return (
        <ResponsiveSettingsDialog
            open={open}
            onOpenChange={onOpenChange}
            title="الإعدادات"
            contentClassName="max-w-2xl md:max-w-3xl"
        >
            <HomeSettingsBody {...props} />
        </ResponsiveSettingsDialog>
    );
}
