import React, { useId } from 'react';
import { MapPin } from 'lucide-react';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { governoratesByPickerOrder, type Governorate } from '@/Domain/geography/governorates';
import LocationModeSelector from '@/Domain/location/LocationModeSelector';
import {
  isDeviceLocation,
  updateLocationPreference,
  useLocationPreference,
  usesCustomCoordinates,
  type LocationPatch,
} from '@/Domain/location/preference';
import { PRAYER_METHODS } from './methods';

/**
 * The prayer-settings fields: location source, city, manual coordinates and
 * (optionally) the calculation method. Home, Roznama and `/muslim` render this
 * one component and pass only what their copy or layout genuinely differs on.
 *
 * The location fields are written through `Domain/location`, so they are the
 * same preference the timings and the weather are fetched with; `onLocationChange`
 * lets a surface mirror the change to the account, which is the only part it owns.
 */
export interface PrayerSettingsFieldsProps {
  /** The list the surface has always shown (declaration or prayer-picker order). */
  cities?: readonly Governorate[];
  /** The surface's own label for the city field. */
  cityLabel?: string;
  /** Home shows the label without the pin. */
  cityLabelIcon?: boolean;
  /** False when the surface prints its own "current location" summary above. */
  showGeoLabel?: boolean;
  /** Home tells the user to type coordinates when both are empty. */
  showEmptyCoordsHint?: boolean;
  /** Omit to hide the calculation-method select (Home). */
  method?: number;
  onMethodChange?: (method: number) => void;
  /** Extra copy under the method select (the fiqh note on `/muslim`). */
  methodNote?: React.ReactNode;
  /** Fired after the location preference is updated; surfaces sync it to the account. */
  onLocationChange?: (patch: LocationPatch) => void;
}

export default function PrayerSettingsFields({
  cities,
  cityLabel = 'المدينة',
  cityLabelIcon = true,
  showGeoLabel = true,
  showEmptyCoordsHint = false,
  method,
  onMethodChange,
  methodNote,
  onLocationChange,
}: PrayerSettingsFieldsProps) {
  const location = useLocationPreference();
  const latId = useId();
  const lonId = useId();

  const apply = (patch: LocationPatch) => {
    updateLocationPreference(patch);
    onLocationChange?.(patch);
  };

  const deviceLocation = isDeviceLocation(location);
  const custom = usesCustomCoordinates(location);
  const list = cities ?? governoratesByPickerOrder();

  return (
    <div className="space-y-4">
      <LocationModeSelector
        mode={location.mode}
        onChange={(mode) => apply({ mode, useCustomCoords: mode === 'custom' })}
      />

      {showGeoLabel && deviceLocation && location.geo && (
        <div className="rounded-lg border border-border/50 bg-card/10 p-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            الموقع الحالي:{' '}
            <span className="font-semibold text-foreground">{location.geo.label}</span>
            <span dir="ltr" className="tabular-nums">
              {' '}
              ({location.geo.lat}، {location.geo.lon})
            </span>
          </p>
        </div>
      )}

      {location.mode === 'city' && (
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            {cityLabelIcon && <MapPin className="h-4 w-4 text-primary" />} {cityLabel}
          </Label>
          <Select value={location.city} onValueChange={(city) => apply({ city })}>
            <SelectTrigger dir="rtl" aria-label={cityLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {list.map((governorate) => (
                <SelectItem key={governorate.id} value={governorate.id}>
                  {governorate.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {custom && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 bg-card/10 p-3">
          <div className="space-y-1">
            <Label htmlFor={latId} className="text-xs">
              خط العرض (Lat)
            </Label>
            <Input
              id={latId}
              dir="ltr"
              inputMode="decimal"
              placeholder="33.51"
              value={location.customLat}
              onChange={(e) => apply({ customLat: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={lonId} className="text-xs">
              خط الطول (Lon)
            </Label>
            <Input
              id={lonId}
              dir="ltr"
              inputMode="decimal"
              placeholder="36.27"
              value={location.customLon}
              onChange={(e) => apply({ customLon: e.target.value })}
            />
          </div>
        </div>
      )}

      {showEmptyCoordsHint && custom && location.customLat === '' && location.customLon === '' && (
        <p className="text-[11px] text-muted-foreground">أدخل الإحداثيات يدوياً.</p>
      )}

      {method !== undefined && (
        <div className="space-y-2">
          <Label className="text-sm font-semibold">طريقة الحساب</Label>
          <Select
            value={String(method)}
            onValueChange={(value) => onMethodChange?.(Number(value))}
          >
            <SelectTrigger dir="rtl" aria-label="طريقة الحساب">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              {PRAYER_METHODS.map((m) => (
                <SelectItem key={m.id} value={String(m.id)}>
                  {m.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {PRAYER_METHODS.find((m) => m.id === method)?.detail}
            {methodNote}
          </p>
        </div>
      )}
    </div>
  );
}
