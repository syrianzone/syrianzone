import { useSyncExternalStore } from 'react';
import { GOVERNORATES_BY_ID, getGovernorateNameAr } from '@/Domain/geography/governorates';
import {
  LOC_CHANGED_EVENT,
  clearGeo,
  getGeo,
  getLocMode,
  setGeo,
  setLocMode,
  type GeoPoint,
  type LocMode,
} from './location';

/**
 * The user's location preference, and the only module that reads or writes the
 * device keys that store it.
 *
 * Two key families hold the same facts. The **prayer family** (`sz-muslim-city`,
 * `sz-muslim-use-custom`, `sz-muslim-lat`, `sz-muslim-lon`) is written by
 * `/muslim` and conflict-tracked by the login sync (`muslimCity`, `customLoc`),
 * so it is canonical: reads prefer it. The **display family**
 * (`governorate`, `sz-roznama-governorate`, `useCustomCoords`, `customLat`,
 * `customLon`) predates it and is what Home and Roznama used to read on their
 * own. Every write lands in both families, so one edit anywhere moves every
 * surface and the sync engine keeps comparing one value. Key names and stored
 * shapes are unchanged.
 */

export interface LocationPreference {
  /** Governorate id (`damascus`, …). */
  city: string;
  /** The legacy "manual coordinates" switch; also true in `custom` mode. */
  useCustomCoords: boolean;
  /** Raw input strings, as typed: the settings inputs are uncontrolled strings. */
  customLat: string;
  customLon: string;
  /** Where the coordinates come from: manual city, GPS, IP or manual numbers. */
  mode: LocMode;
  /** Last resolved GPS/IP point. Device-only, never synced. */
  geo: GeoPoint | null;
}

export type LocationPatch = Partial<
  Pick<LocationPreference, 'city' | 'useCustomCoords' | 'customLat' | 'customLon' | 'mode' | 'geo'>
>;

/** Which conflict-tracked channel a city write belongs to (see the doc block). */
export type CityChannel = 'prayer' | 'display';

export interface AccountLocation {
  city?: string | null;
  useCustomCoords?: boolean | null;
  customLat?: string | number | null;
  customLon?: string | number | null;
}

export const DEFAULT_CITY = 'damascus';

const CITY_KEYS = {
  prayer: 'sz-muslim-city',
  display: 'governorate',
  roznama: 'sz-roznama-governorate',
} as const;

const CUSTOM_KEYS = {
  useCustom: 'sz-muslim-use-custom',
  lat: 'sz-muslim-lat',
  lon: 'sz-muslim-lon',
  legacyUseCustom: 'useCustomCoords',
  legacyLat: 'customLat',
  legacyLon: 'customLon',
} as const;

const DEFAULT_LOCATION: LocationPreference = {
  city: DEFAULT_CITY,
  useCustomCoords: false,
  customLat: '',
  customLon: '',
  mode: 'city',
  geo: null,
};

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // private mode: the session still works, nothing is persisted
  }
}

/** A slug we do not recognise counts as absent, the rule the login sync uses. */
function knownCity(value: string | null): string | null {
  return value && GOVERNORATES_BY_ID[value] ? value : null;
}

function numberOrNull(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// --- device state, one key family at a time (the login sync reads these) ---

/** `prayer` is `sz-muslim-city`; `display` is the Home/Roznama pair. */
export function readDeviceCity(channel: CityChannel): string | null {
  if (channel === 'prayer') return read(CITY_KEYS.prayer);
  return read(CITY_KEYS.display) ?? read(CITY_KEYS.roznama);
}

export function writeDeviceCity(channel: CityChannel, city: string): void {
  if (channel === 'prayer') {
    write(CITY_KEYS.prayer, city);
  } else {
    write(CITY_KEYS.display, city);
    write(CITY_KEYS.roznama, city);
  }
  notifyLocationChanged();
}

function writeEveryCity(city: string): void {
  write(CITY_KEYS.prayer, city);
  write(CITY_KEYS.display, city);
  write(CITY_KEYS.roznama, city);
}

export interface DeviceCustomCoords {
  /** `'true'`/`'false'`/null, the shape the login sync compares. */
  on: string | null;
  lat: string;
  lon: string;
}

/** The stored custom-coordinate group, or null when no key of either family exists. */
export function readDeviceCustomCoords(): DeviceCustomCoords | null {
  const on = read(CUSTOM_KEYS.useCustom) ?? read(CUSTOM_KEYS.legacyUseCustom);
  const lat = read(CUSTOM_KEYS.lat) ?? read(CUSTOM_KEYS.legacyLat) ?? '';
  const lon = read(CUSTOM_KEYS.lon) ?? read(CUSTOM_KEYS.legacyLon) ?? '';
  if (on === null && lat === '' && lon === '') return null;
  return { on, lat, lon };
}

export function writeDeviceCustomCoords(patch: Partial<DeviceCustomCoords>): void {
  if (patch.on !== undefined && patch.on !== null) {
    write(CUSTOM_KEYS.useCustom, patch.on);
    write(CUSTOM_KEYS.legacyUseCustom, patch.on);
  }
  if (patch.lat !== undefined) {
    write(CUSTOM_KEYS.lat, patch.lat);
    write(CUSTOM_KEYS.legacyLat, patch.lat);
  }
  if (patch.lon !== undefined) {
    write(CUSTOM_KEYS.lon, patch.lon);
    write(CUSTOM_KEYS.legacyLon, patch.lon);
  }
  notifyLocationChanged();
}

// --- the composed preference ---

export function readLocationPreference(): LocationPreference {
  if (typeof window === 'undefined') return DEFAULT_LOCATION;

  const city =
    knownCity(read(CITY_KEYS.prayer)) ??
    knownCity(read(CITY_KEYS.display)) ??
    knownCity(read(CITY_KEYS.roznama)) ??
    DEFAULT_CITY;

  const useCustomStored = read(CUSTOM_KEYS.useCustom) ?? read(CUSTOM_KEYS.legacyUseCustom);

  return {
    city,
    useCustomCoords: useCustomStored === 'true',
    customLat: read(CUSTOM_KEYS.lat) ?? read(CUSTOM_KEYS.legacyLat) ?? '',
    customLon: read(CUSTOM_KEYS.lon) ?? read(CUSTOM_KEYS.legacyLon) ?? '',
    mode: getLocMode(),
    geo: getGeo(),
  };
}

let snapshot: LocationPreference | null = null;
const listeners = new Set<() => void>();
let listening = false;

function notifyLocationChanged(): void {
  snapshot = null;
  for (const listener of listeners) listener();
}

function subscribeLocation(listener: () => void): () => void {
  listeners.add(listener);
  if (!listening && typeof window !== 'undefined') {
    // `location.ts` announces its own writes (mode + resolved point) this way.
    window.addEventListener(LOC_CHANGED_EVENT, notifyLocationChanged);
    listening = true;
  }
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): LocationPreference {
  snapshot ??= readLocationPreference();
  return snapshot;
}

function getServerSnapshot(): LocationPreference {
  return DEFAULT_LOCATION;
}

/** The preference, re-read whenever any surface writes it. */
export function useLocationPreference(): LocationPreference {
  return useSyncExternalStore(subscribeLocation, getSnapshot, getServerSnapshot);
}

/**
 * Write the preference. `mode` also drives `useCustomCoords` (the mode radio is
 * the custom-coordinates switch on every surface), exactly as the three settings
 * dialogs each did before.
 */
export function updateLocationPreference(patch: LocationPatch): void {
  if (patch.city !== undefined) writeEveryCity(patch.city);
  if (patch.useCustomCoords !== undefined || patch.mode !== undefined) {
    const useCustom = patch.useCustomCoords ?? patch.mode === 'custom';
    writeDeviceCustomCoords({ on: String(useCustom) });
  }
  if (patch.customLat !== undefined) writeDeviceCustomCoords({ lat: patch.customLat });
  if (patch.customLon !== undefined) writeDeviceCustomCoords({ lon: patch.customLon });
  if (patch.mode !== undefined) setLocMode(patch.mode);
  if (patch.geo !== undefined) {
    if (patch.geo === null) clearGeo();
    else setGeo(patch.geo);
  }
  notifyLocationChanged();
}

/**
 * Mount-time seed from the account: fill the device keys that do not exist yet,
 * never overwrite one that does. The login sync compares both sides on its own
 * and the conflict modal owns the overwrite decision
 * (docs/modules/settings-sync.md §4).
 */
export function adoptAccountLocation(account: AccountLocation | null | undefined): void {
  if (!account || typeof window === 'undefined') return;

  let changed = false;
  const city = typeof account.city === 'string' ? knownCity(account.city) : null;
  const hasCity =
    read(CITY_KEYS.prayer) !== null ||
    read(CITY_KEYS.display) !== null ||
    read(CITY_KEYS.roznama) !== null;
  if (!hasCity && city !== null) {
    writeEveryCity(city);
    changed = true;
  }

  const stored = readDeviceCustomCoords();
  if (stored === null) {
    const on = typeof account.useCustomCoords === 'boolean' ? String(account.useCustomCoords) : null;
    const lat = account.customLat === null || account.customLat === undefined || account.customLat === ''
      ? null
      : String(account.customLat);
    const lon = account.customLon === null || account.customLon === undefined || account.customLon === ''
      ? null
      : String(account.customLon);
    if (on !== null || lat !== null || lon !== null) {
      writeDeviceCustomCoords({
        ...(on !== null ? { on } : {}),
        ...(lat !== null ? { lat } : {}),
        ...(lon !== null ? { lon } : {}),
      });
      changed = true;
    }
  }

  if (changed) notifyLocationChanged();
}

// --- resolvers: preference -> coordinates, labels and request params ---

/** GPS/IP point resolved earlier in this session. */
export function isDeviceLocation(pref: LocationPreference): boolean {
  return (pref.mode === 'gps' || pref.mode === 'ip') && pref.geo !== null;
}

/** Manual numbers are in play, either through the mode or the legacy switch. */
export function usesCustomCoordinates(pref: LocationPreference): boolean {
  return pref.useCustomCoords || pref.mode === 'custom';
}

function customPoint(pref: LocationPreference): { lat: number; lon: number } | null {
  if (!usesCustomCoordinates(pref)) return null;
  const lat = numberOrNull(pref.customLat);
  const lon = numberOrNull(pref.customLon);
  return lat !== null && lon !== null ? { lat, lon } : null;
}

/**
 * The `/api/prayer-times` parameters for this preference: a resolved GPS/IP
 * point, then manual coordinates, then the governorate slug.
 */
export function resolvePrayerParams(
  pref: LocationPreference,
  method: number,
): Record<string, string | number> {
  if (isDeviceLocation(pref) && pref.geo) {
    return { latitude: pref.geo.lat, longitude: pref.geo.lon, method };
  }
  const custom = customPoint(pref);
  if (custom) return { latitude: custom.lat, longitude: custom.lon, method };
  return { governorate: pref.city || DEFAULT_CITY, method };
}

/** The point the weather proxy is asked about (same order as the prayer params). */
export function resolveWeatherPoint(pref: LocationPreference): { lat: number; lon: number } {
  if (isDeviceLocation(pref) && pref.geo) return { lat: pref.geo.lat, lon: pref.geo.lon };
  const custom = customPoint(pref);
  if (custom) return custom;
  const governorate = GOVERNORATES_BY_ID[pref.city] ?? GOVERNORATES_BY_ID[DEFAULT_CITY];
  return { lat: governorate.lat, lon: governorate.lng };
}

/** The place name a surface prints for the numbers it shows. */
export function resolvePlaceLabel(pref: LocationPreference): string {
  if (isDeviceLocation(pref) && pref.geo) return pref.geo.label;
  if (usesCustomCoordinates(pref)) return 'إحداثيات مخصصة';
  return getGovernorateNameAr(pref.city);
}
