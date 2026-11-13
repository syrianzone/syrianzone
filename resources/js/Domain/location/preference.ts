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
 *
 * The account stores the same two families (`governorate`/`muslimCity`,
 * `useCustomCoords/customLat/customLon` vs `muslimUseCustomCoords/muslimLat/
 * muslimLon`). `accountLocation()` and `accountCustomCoords()` are the only
 * reader of that pair, so adoption and the login sync see one account location
 * rather than two spellings that disagree.
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

/**
 * The account's location: the display family (`governorate`, `useCustomCoords`,
 * `customLat`, `customLon`) and the prayer family (`muslimCity`,
 * `muslimUseCustomCoords`, `muslimLat`, `muslimLon`). Both hold the same fact on
 * the account exactly as they do on the device, so this module reads them as one
 * location and is the only place that knows the two spellings.
 */
export interface AccountLocation {
  /** Display-family city (`settings.governorate`). */
  city?: string | null;
  useCustomCoords?: boolean | null;
  customLat?: string | number | null;
  customLon?: string | number | null;
  /** Prayer-family city (`settings.muslimCity`). */
  muslimCity?: string | null;
  muslimUseCustomCoords?: boolean | null;
  muslimLat?: string | number | null;
  muslimLon?: string | number | null;
}

/** An account settings payload, as `users.settings` and the Inertia page prop carry it. */
export interface AccountLocationSettings {
  governorate?: unknown;
  muslimCity?: unknown;
  useCustomCoords?: unknown;
  customLat?: unknown;
  customLon?: unknown;
  muslimUseCustomCoords?: unknown;
  muslimLat?: unknown;
  muslimLon?: unknown;
}

/** The account's location read from a settings payload, one field per stored key. */
export function accountLocation(
  settings: AccountLocationSettings | null | undefined,
): AccountLocation {
  const text = (value: unknown): string | null =>
    value === null || value === undefined || value === '' ? null : String(value);
  const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);

  return {
    city: text(settings?.governorate),
    useCustomCoords: flag(settings?.useCustomCoords),
    customLat: text(settings?.customLat),
    customLon: text(settings?.customLon),
    muslimCity: text(settings?.muslimCity),
    muslimUseCustomCoords: flag(settings?.muslimUseCustomCoords),
    muslimLat: text(settings?.muslimLat),
    muslimLon: text(settings?.muslimLon),
  };
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

/** The account's city for one key family: its own key, else the other family's. */
function accountCity(
  own: string | null | undefined,
  other: string | null | undefined,
): string | null {
  const city = typeof own === 'string' ? knownCity(own) : null;
  if (city !== null) return city;
  return typeof other === 'string' ? knownCity(other) : null;
}

function numberOrNull(value: string): number | null {
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

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

/**
 * The account's manual-coordinate unit, or null when the account holds no key of
 * either family. The two families are one fact (Home wrote the display pair,
 * `/muslim` the prayer pair), so a value in either is the account's value; the
 * prayer family wins when both exist, the same precedence as a device read.
 */
export function accountCustomCoords(
  account: AccountLocation | null | undefined,
): DeviceCustomCoords | null {
  const on = account?.muslimUseCustomCoords ?? account?.useCustomCoords ?? null;
  const lat = account?.muslimLat ?? account?.customLat ?? '';
  const lon = account?.muslimLon ?? account?.customLon ?? '';
  const latText = String(lat);
  const lonText = String(lon);
  if (on === null && latText === '' && lonText === '') return null;

  return {
    on: typeof on === 'boolean' ? String(on) : null,
    lat: latText,
    lon: lonText,
  };
}

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
 * the custom-coordinates switch on every surface).
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
 * Adopt the account's location onto an empty device: fill the device keys that
 * do not exist yet, never overwrite one that does. The login sync calls this
 * (docs/modules/settings-sync.md §4): one owner, called before the sync compares
 * the two sides, so filling a gap cannot be mistaken for a device-vs-account
 * disagreement.
 *
 * Each device family is filled from the account's own family, and falls back to
 * the other one — both families hold the same fact, so a user who only ever set
 * the city on one surface still gets it everywhere.
 */
export function adoptAccountLocation(account: AccountLocation | null | undefined): void {
  if (!account || typeof window === 'undefined') return;

  let changed = false;

  const displayCity = accountCity(account.city, account.muslimCity);
  if (displayCity !== null && readDeviceCity('display') === null) {
    write(CITY_KEYS.display, displayCity);
    write(CITY_KEYS.roznama, displayCity);
    changed = true;
  }

  const prayerCity = accountCity(account.muslimCity, account.city);
  if (prayerCity !== null && read(CITY_KEYS.prayer) === null) {
    write(CITY_KEYS.prayer, prayerCity);
    changed = true;
  }

  const coords = accountCustomCoords(account);
  if (coords !== null && readDeviceCustomCoords() === null) {
    writeDeviceCustomCoords(coords);
    changed = true;
  }

  if (changed) notifyLocationChanged();
}

/** '' clears the account value; a half-typed coordinate is skipped, not sent. */
function accountCoordinate(value: string): number | null | undefined {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The account mirror of a device-side location edit. Home and Roznama both show
 * the same fields and post what the user changed; the account's key spelling is
 * this module's, so neither page has to know it. An emptied coordinate field
 * travels as null (the server takes it as "cleared"), which the device's own
 * empty string does not survive as.
 */
export function accountPatchForLocation(patch: LocationPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.city !== undefined) out.governorate = patch.city;
  if (patch.useCustomCoords !== undefined) out.useCustomCoords = patch.useCustomCoords;
  if (patch.customLat !== undefined) {
    const lat = accountCoordinate(patch.customLat);
    if (lat !== undefined) out.customLat = lat;
  }
  if (patch.customLon !== undefined) {
    const lon = accountCoordinate(patch.customLon);
    if (lon !== undefined) out.customLon = lon;
  }
  return out;
}

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
