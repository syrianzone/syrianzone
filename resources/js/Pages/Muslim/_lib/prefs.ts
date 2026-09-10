import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import axios from '@/Lib/axios';
import { DEFAULT_PRAYER_METHOD } from './methods';
import { effectivePrayerParams, getGeo, getLocMode, setGeo, setLocMode, clearGeo, LOC_CHANGED_EVENT, type GeoPoint, type LocMode } from './location';

// Single source of truth for everything the prayer widgets share.
// /muslim is the writer; Home, Board and Roznama are readers.
// Guests persist to localStorage only; logged-in users also sync to
// users.settings via POST /api/user/settings (debounced, same pattern as
// Home.tsx saveAccountSettings).
export interface MuslimPrefs {
  city: string;
  useCustomCoords: boolean;
  customLat: string;
  customLon: string;
  method: number;
  /** Location mode: manual city list, GPS, or IP. Device-local. */
  locMode: LocMode;
  /** Last resolved GPS/IP point. Device-local, never synced to the account. */
  geo: GeoPoint | null;
  /** Per-day prayer completion: { 'YYYY-MM-DD' (Asia/Damascus): { Fajr: true } } */
  prayerLog: Record<string, Record<string, boolean>>;
  quranPage: number;
  quranReciterId: string;
}

interface AuthSettings {
  muslimCity?: string;
  muslimMethod?: number;
  muslimUseCustomCoords?: boolean;
  muslimLat?: number | string;
  muslimLon?: number | string;
  prayerLog?: Record<string, Record<string, boolean>>;
  quranLastPage?: number;
  quranReciterId?: string;
}

const LS = {
  city: 'sz-muslim-city',
  useCustom: 'sz-muslim-use-custom',
  lat: 'sz-muslim-lat',
  lon: 'sz-muslim-lon',
  method: 'sz-muslim-method',
  plog: 'sz-muslim-prayer-log',
  page: 'sz-muslim-quran-page',
  at: 'sz-muslim-quran-at',
  reciter: 'sz-muslim-quran-reciter',
} as const;

/** LocalStorage keys (exported for the login sync engine — single source). */
export const MUSLIM_LS_KEYS = LS;
export const QURAN_AT_LS_KEY = LS.at;

function readLS(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export const TRACKED_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/** Asia/Damascus calendar day (same boundary the timings API uses). */
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function readPrayerLog(): Record<string, Record<string, boolean>> {
  try {
    const raw = readLS(LS.plog, '');
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Record<string, boolean>>;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Keep the log bounded (last 31 days) before persisting. */
export function prunePrayerLog(log: Record<string, Record<string, boolean>>): Record<string, Record<string, boolean>> {
  const keys = Object.keys(log).sort();
  const pruned: Record<string, Record<string, boolean>> = {};
  for (const k of keys.slice(-31)) pruned[k] = log[k];
  return pruned;
}

export function defaultMuslimPrefs(): MuslimPrefs {
  return {
    city: readLS(LS.city, readLS('governorate', 'damascus')),
    useCustomCoords: readLS(LS.useCustom, '') === 'true',
    customLat: readLS(LS.lat, readLS('customLat', '')),
    customLon: readLS(LS.lon, readLS('customLon', '')),
    method: Number(readLS(LS.method, String(DEFAULT_PRAYER_METHOD))) || DEFAULT_PRAYER_METHOD,
    locMode: getLocMode(),
    geo: getGeo(),
    prayerLog: readPrayerLog(),
    quranPage: Number(readLS(LS.page, '1')) || 1,
    quranReciterId: readLS(LS.reciter, 'Husary_128kbps'),
  };
}

export function prayerQueryParams(
  p: Pick<MuslimPrefs, 'city' | 'useCustomCoords' | 'customLat' | 'customLon' | 'method' | 'locMode' | 'geo'>,
): Record<string, string | number> {
  return effectivePrayerParams({
    mode: p.locMode,
    geo: p.geo,
    manualCity: p.city,
    method: p.method,
    useCustomCoords: p.useCustomCoords,
    customLat: p.customLat,
    customLon: p.customLon,
  });
}

export function useMuslimPrefs() {
  const { props } = usePage<{ auth?: { user?: { settings?: AuthSettings | null } | null } }>();
  const serverSettings = props.auth?.user?.settings ?? null;
  const isLoggedIn = Boolean((props as unknown as { auth?: { user?: { id?: number } } }).auth?.user?.id);

  const [prefs, setPrefsState] = useState<MuslimPrefs>(() => {
    const base = defaultMuslimPrefs();
    if (!serverSettings) return base;
    return {
      ...base,
      city: serverSettings.muslimCity ?? base.city,
      method: serverSettings.muslimMethod ?? base.method,
      useCustomCoords: serverSettings.muslimUseCustomCoords ?? base.useCustomCoords,
      customLat: serverSettings.muslimLat !== undefined ? String(serverSettings.muslimLat) : base.customLat,
      customLon: serverSettings.muslimLon !== undefined ? String(serverSettings.muslimLon) : base.customLon,
      prayerLog: serverSettings.prayerLog ?? base.prayerLog,
      quranPage: serverSettings.quranLastPage ?? base.quranPage,
      quranReciterId: serverSettings.quranReciterId ?? base.quranReciterId,
    };
  });

  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (!isLoggedIn) return;
    const payload = pending.current;
    pending.current = {};
    if (Object.keys(payload).length === 0) return;
    try {
      await axios.post('/api/user/settings', { settings: payload });
    } catch {
      // localStorage already holds the value; server sync is best-effort
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onHide);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [flush]);

  // Device-local geo/mode may change from any surface (Home, Roznama,
  // Board follow the same storage): re-read into state on change.
  useEffect(() => {
    const sync = () => {
      setPrefsState((prev) => {
        const locMode = getLocMode();
        const geo = getGeo();
        if (prev.locMode === locMode && JSON.stringify(prev.geo) === JSON.stringify(geo)) return prev;
        return { ...prev, locMode, geo };
      });
    };
    window.addEventListener(LOC_CHANGED_EVENT, sync);
    return () => window.removeEventListener(LOC_CHANGED_EVENT, sync);
  }, []);

  const setPrefs = useCallback(
    (patch: Partial<MuslimPrefs>) => {
      // locMode/geo live in location.ts storage (device-local, event-synced).
      if (patch.locMode !== undefined) setLocMode(patch.locMode);
      if (patch.geo !== undefined) {
        if (patch.geo === null) clearGeo();
        else setGeo(patch.geo);
      }
      setPrefsState((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(LS.city, next.city);
          window.localStorage.setItem(LS.useCustom, String(next.useCustomCoords));
          window.localStorage.setItem(LS.lat, next.customLat);
          window.localStorage.setItem(LS.lon, next.customLon);
          window.localStorage.setItem(LS.method, String(next.method));
          window.localStorage.setItem(LS.plog, JSON.stringify(prunePrayerLog(next.prayerLog)));
          window.localStorage.setItem(LS.page, String(next.quranPage));
          window.localStorage.setItem(LS.reciter, next.quranReciterId);
          // Fan-out to the legacy keys Home + Roznama already read, so the
          // city saved in /muslim drives every prayer widget on the site.
          if (patch.city !== undefined) {
            window.localStorage.setItem('governorate', next.city);
            window.localStorage.setItem('sz-roznama-governorate', next.city);
          }
        } catch {
          // private mode: state still works for the session
        }
        return next;
      });

      if (!isLoggedIn) return;
      const serverPatch: Record<string, unknown> = {};
      if (patch.city !== undefined) serverPatch.muslimCity = patch.city;
      if (patch.method !== undefined) serverPatch.muslimMethod = patch.method;
      if (patch.useCustomCoords !== undefined) serverPatch.muslimUseCustomCoords = patch.useCustomCoords;
      if (patch.customLat !== undefined) serverPatch.muslimLat = patch.customLat === '' ? null : Number(patch.customLat);
      if (patch.customLon !== undefined) serverPatch.muslimLon = patch.customLon === '' ? null : Number(patch.customLon);
      if (patch.prayerLog !== undefined) serverPatch.prayerLog = prunePrayerLog(patch.prayerLog);
      if (patch.quranPage !== undefined) {
        serverPatch.quranLastPage = patch.quranPage;
        // Stamp reading position for newer-wins login merges.
        const at = Date.now();
        try {
          window.localStorage.setItem(LS.at, String(at));
        } catch {
          // ignore
        }
        serverPatch.quranPageAt = Math.floor(at / 1000);
      }
      if (patch.quranReciterId !== undefined) serverPatch.quranReciterId = patch.quranReciterId;
      pending.current = { ...pending.current, ...serverPatch };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 600);
    },
    [flush, isLoggedIn],
  );

  return { prefs, setPrefs, isLoggedIn };
}
