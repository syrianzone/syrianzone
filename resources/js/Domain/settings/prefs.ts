import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import { api } from '@/Lib/api';
import { SYRIA_TIMEZONE } from '@/Domain/geography/syria';
import { DEFAULT_PRAYER_METHOD } from '../prayer/methods';
import { DEFAULT_RECITATION_CODE, normalizeRecitationCode } from '../quran/quran';
import {
  readLocationPreference,
  updateLocationPreference,
  useLocationPreference,
  type LocationPatch,
} from '../location/preference';
import type { GeoPoint, LocMode } from '../location/location';

// The account side of the prayer widgets' preferences: the calculation method,
// the prayer log and the Quran position. The location half (city, manual
// coordinates, mode and resolved point) is owned by `Domain/location`; this
// module mirrors it into `MuslimPrefs` and mirrors edits to `users.settings`.
// Guests persist to localStorage only; logged-in users also sync to
// users.settings via POST /api/user/settings (debounced).
export interface MuslimPrefs {
  city: string;
  useCustomCoords: boolean;
  customLat: string;
  customLon: string;
  method: number;
  /** Location mode: manual city list, GPS, IP or manual coordinates. Device-local. */
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
  method: 'sz-muslim-method',
  plog: 'sz-muslim-prayer-log',
  page: 'sz-muslim-quran-page',
  at: 'sz-muslim-quran-at',
  reciter: 'sz-muslim-quran-reciter',
} as const;

/** LocalStorage keys of the non-location prefs (exported for the login sync engine). */
export const MUSLIM_LS_KEYS = LS;

function readLS(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export const TRACKED_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

/** The national calendar day (same boundary the timings API uses). */
export function todayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SYRIA_TIMEZONE,
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

/** The stored calculation method, falling back to the Syrian standard. */
export function readStoredMethod(): number {
  return Number(readLS(LS.method, String(DEFAULT_PRAYER_METHOD))) || DEFAULT_PRAYER_METHOD;
}

/** Store the calculation method (the account mirror is a separate `setPrefs` call). */
export function writeStoredMethod(method: number): void {
  try {
    window.localStorage.setItem(LS.method, String(method));
  } catch {
    // private mode: state still works for the session
  }
}

export function defaultMuslimPrefs(): MuslimPrefs {
  const location = readLocationPreference();
  return {
    city: location.city,
    useCustomCoords: location.useCustomCoords,
    customLat: location.customLat,
    customLon: location.customLon,
    method: readStoredMethod(),
    locMode: location.mode,
    geo: location.geo,
    prayerLog: readPrayerLog(),
    quranPage: Number(readLS(LS.page, '1')) || 1,
    quranReciterId: normalizeRecitationCode(readLS(LS.reciter, DEFAULT_RECITATION_CODE)),
  };
}

export function useMuslimPrefs() {
  const { props } = usePage<{ auth?: { user?: { settings?: AuthSettings | null } | null } }>();
  const serverSettings = props.auth?.user?.settings ?? null;
  const isLoggedIn = Boolean((props as unknown as { auth?: { user?: { id?: number } } }).auth?.user?.id);
  const location = useLocationPreference();

  const [prefs, setPrefsState] = useState<MuslimPrefs>(() => {
    const base = defaultMuslimPrefs();
    if (!serverSettings) return base;
    return {
      ...base,
      method: serverSettings.muslimMethod ?? base.method,
      prayerLog: serverSettings.prayerLog ?? base.prayerLog,
      quranPage: serverSettings.quranLastPage ?? base.quranPage,
      quranReciterId: serverSettings.quranReciterId
        ? normalizeRecitationCode(serverSettings.quranReciterId)
        : base.quranReciterId,
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
      await api.post('/api/user/settings', { settings: payload });
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

  const setPrefs = useCallback(
    (patch: Partial<MuslimPrefs>) => {
      // Location fields belong to Domain/location: it writes the device keys
      // both key families read and tells every surface.
      const locationPatch: LocationPatch = {};
      if (patch.city !== undefined) locationPatch.city = patch.city;
      if (patch.useCustomCoords !== undefined) locationPatch.useCustomCoords = patch.useCustomCoords;
      if (patch.customLat !== undefined) locationPatch.customLat = patch.customLat;
      if (patch.customLon !== undefined) locationPatch.customLon = patch.customLon;
      if (patch.locMode !== undefined) locationPatch.mode = patch.locMode;
      if (patch.geo !== undefined) locationPatch.geo = patch.geo;
      if (Object.keys(locationPatch).length > 0) updateLocationPreference(locationPatch);

      const devicePatch =
        patch.method !== undefined ||
        patch.prayerLog !== undefined ||
        patch.quranPage !== undefined ||
        patch.quranReciterId !== undefined;
      if (devicePatch) {
        setPrefsState((prev) => {
          const next = { ...prev, ...patch };
          try {
            if (patch.method !== undefined) window.localStorage.setItem(LS.method, String(next.method));
            if (patch.prayerLog !== undefined) {
              window.localStorage.setItem(LS.plog, JSON.stringify(prunePrayerLog(next.prayerLog)));
            }
            if (patch.quranPage !== undefined) window.localStorage.setItem(LS.page, String(next.quranPage));
            if (patch.quranReciterId !== undefined) {
              window.localStorage.setItem(LS.reciter, next.quranReciterId);
            }
          } catch {
            // private mode: state still works for the session
          }
          return next;
        });
      }

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

  return {
    prefs: {
      ...prefs,
      city: location.city,
      useCustomCoords: location.useCustomCoords,
      customLat: location.customLat,
      customLon: location.customLon,
      locMode: location.mode,
      geo: location.geo,
    },
    setPrefs,
    isLoggedIn,
  };
}
