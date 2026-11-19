import rows from '../../../resources/data/governorates.json';
import { validTimeZone } from './prayer-zone';

export type LocMode = 'city' | 'gps' | 'ip' | 'custom';
export interface GeoPoint { lat: number; lon: number; label: string; source: 'gps' | 'ip'; at: number; timezone?: string }
export interface LocationPreference {
  city: string; useCustomCoords: boolean; customLat: string; customLon: string; mode: LocMode; geo: GeoPoint | null;
}
export type LocationPatch = Partial<LocationPreference>;
export const governorates = rows.slice().sort((a, b) => a.picker_order - b.picker_order)
  .map(row => ({ id: row.id, nameAr: row.name_ar, lat: row.lat, lng: row.lng }));
export const defaultLocation: LocationPreference = { city: 'damascus', useCustomCoords: false, customLat: '', customLon: '', mode: 'city', geo: null };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function coordinate(value: unknown, limit: number): number | null {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}
export function decodeLocation(value: unknown): LocationPreference {
  const item = record(value), point = record(item.geo);
  const lat = coordinate(point.lat, 90), lon = coordinate(point.lon, 180);
  const geo: GeoPoint | null = lat !== null && lon !== null && (point.source === 'gps' || point.source === 'ip')
    && typeof point.label === 'string' && typeof point.at === 'number' && Number.isFinite(point.at)
    ? { lat, lon, label: point.label.slice(0, 200), source: point.source, at: point.at, ...(validTimeZone(point.timezone) ? { timezone: point.timezone } : {}) } : null;
  return {
    city: typeof item.city === 'string' && governorates.some(city => city.id === item.city) ? item.city : defaultLocation.city,
    useCustomCoords: item.useCustomCoords === true,
    customLat: typeof item.customLat === 'string' ? item.customLat.slice(0, 32) : '',
    customLon: typeof item.customLon === 'string' ? item.customLon.slice(0, 32) : '',
    mode: item.mode === 'gps' || item.mode === 'ip' || item.mode === 'custom' ? item.mode : 'city', geo,
  };
}
export function isDeviceLocation(preference: LocationPreference): boolean {
  return (preference.mode === 'gps' || preference.mode === 'ip') && preference.geo !== null;
}
export function usesCustomCoordinates(preference: LocationPreference): boolean { return preference.useCustomCoords || preference.mode === 'custom'; }
function customPoint(preference: LocationPreference): { lat: number; lon: number } | null {
  if (!usesCustomCoordinates(preference)) return null;
  const lat = coordinate(preference.customLat, 90), lon = coordinate(preference.customLon, 180);
  return lat !== null && lon !== null ? { lat, lon } : null;
}
export function resolveWeatherPoint(preference: LocationPreference): { lat: number; lon: number } {
  if (isDeviceLocation(preference) && preference.geo) return { lat: preference.geo.lat, lon: preference.geo.lon };
  const custom = customPoint(preference);
  if (custom) return custom;
  const city = governorates.find(row => row.id === preference.city) ?? governorates.find(row => row.id === defaultLocation.city);
  if (!city) throw new Error('بيانات المحافظات غير متاحة.');
  return { lat: city.lat, lon: city.lng };
}
export function resolvePrayerParams(preference: LocationPreference, method: number): Record<string, string | number> {
  if (isDeviceLocation(preference) && preference.geo) return { latitude: preference.geo.lat, longitude: preference.geo.lon, method };
  const custom = customPoint(preference);
  return custom ? { latitude: custom.lat, longitude: custom.lon, method } : { governorate: preference.city || defaultLocation.city, method };
}
export function resolvePlaceLabel(preference: LocationPreference): string {
  if (isDeviceLocation(preference) && preference.geo) return preference.geo.label;
  if (usesCustomCoordinates(preference) && customPoint(preference)) return 'إحداثيات مخصصة';
  return governorates.find(row => row.id === preference.city)?.nameAr ?? 'دمشق';
}
export function accountPatchForLocation(patch: LocationPatch): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (patch.city !== undefined) result.governorate = patch.city;
  if (patch.useCustomCoords !== undefined) result.useCustomCoords = patch.useCustomCoords;
  for (const [source, target, limit] of [['customLat', 'customLat', 90], ['customLon', 'customLon', 180]] as const) {
    const value = patch[source];
    if (value === undefined) continue;
    if (value.trim() === '') result[target] = null;
    else { const parsed = coordinate(value, limit); if (parsed !== null) result[target] = parsed; }
  }
  return result;
}

// PORT STATUS: source resources/js/Domain/location/preference.ts; confidence high; todos 0.
