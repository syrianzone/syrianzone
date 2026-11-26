import { useCallback, useEffect, useRef, useState } from 'react';
import { api as client, apiErrorMessage } from '@/Lib/api';
import { resolvePrayerParams, resolveWeatherPoint, type LocationPreference } from '../location/preference';
import { SYRIA_TIMEZONE } from '../geography/syria';
import { isValidTimeZone } from './zonedTime';

/**
 * `/api/prayer-times` — the server proxy's response and its one client.
 *
 * Shape comes from `app/Http/Controllers/PrayerController.php`: the six timings
 * normalised to `HH:MM`, plus the Umm al-Qura date the upstream already
 * computed. Surfaces render timings, Hijri date and "next prayer" from here
 * instead of re-parsing an untyped payload each.
 */

export interface PrayerHijri {
  day: string;
  month: string;
  year: string;
}

export interface PrayerTimesResponse {
  /** Governorate slug, or `custom` when coordinates were sent. */
  governorate: string;
  latitude: number;
  longitude: number;
  method: number;
  /** The six keys of `methods.ts` (`PRAYER_KEYS`), `HH:MM`. */
  timings: Record<string, string>;
  /** Null when the upstream omitted it: the surface drops the line. */
  hijri: PrayerHijri | null;
  /** The location's IANA zone, when the server forwards the upstream's. */
  timezone?: string | null;
}

export const PRAYER_TIMES_URL = '/api/prayer-times';

/**
 * The IANA zone the timings are wall-clock times in. The server's zone wins
 * when it sends a valid one; a Syrian governorate is Asia/Damascus; a device
 * point (GPS/IP) or manual coordinates without a server zone fall back to this
 * device's own zone (`undefined`), which is right for a point near the visitor.
 */
export function prayerTimeZone(
  location: LocationPreference,
  serverZone?: string | null,
): string | undefined {
  if (isValidTimeZone(serverZone)) return serverZone;
  if ('governorate' in resolvePrayerParams(location, 0)) return SYRIA_TIMEZONE;
  return undefined;
}

/** The request parameters for a location preference and a calculation method. */
export function prayerTimesParams(
  location: LocationPreference,
  method: number,
): Record<string, string | number> {
  return resolvePrayerParams(location, method);
}

/**
 * Home's per-day cache key: one entry per point/method/day under `sz_prayers_`
 * in `sessionStorage` (the value is a `CachedPrayerTimes` entry).
 */
export function prayerTimesCacheKey(location: LocationPreference, method: number): string {
  const { lat, lon } = resolveWeatherPoint(location);
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `sz_prayers_${lat}_${lon}_${method}_${day}-${month}-${now.getFullYear()}`;
}

export async function fetchPrayerTimes(
  params: Record<string, string | number>,
  signal?: AbortSignal,
): Promise<PrayerTimesResponse> {
  const data = await client.get<PrayerTimesResponse>(PRAYER_TIMES_URL, { params, signal });
  if (!data.timings || typeof data.timings !== 'object') {
    throw new Error('بيانات مواقيت غير صالحة');
  }
  return data;
}

export interface PrayerTimesError {
  message: string;
  /** True only when this hook's own timeout fired, never when a newer request replaced this one. */
  timedOut: boolean;
}

export interface PrayerTimesOptions {
  enabled?: boolean;
  /** Abort after this many ms; `null` keeps the request open. Default 10 000. */
  timeoutMs?: number | null;
  /** Read/write Home's per-day `sessionStorage` entry before fetching. */
  sessionCache?: boolean;
  /** Server-rendered initial timings so SSR paints the prayer table immediately. */
  initialData?: {
    timings: Record<string, string>;
    hijri: PrayerHijri | null;
  } | null;
}

export interface PrayerTimesState {
  timings: Record<string, string> | null;
  hijri: PrayerHijri | null;
  loading: boolean;
  error: PrayerTimesError | null;
  /** The zone the timings are read in (see `prayerTimeZone`). */
  timeZone: string | undefined;
  /** Retry the same request (PrayerView's "إعادة المحاولة"). */
  reload: () => void;
}

/**
 * One cached day: the timings and the zone the server read them in. The zone
 * travels with the timings so a cache hit keeps counting down in the
 * location's zone rather than the device's.
 */
export interface CachedPrayerTimes {
  v: 2;
  timings: Record<string, string>;
  timezone: string | null;
}

/**
 * Parse a cache entry. Older entries stored the bare `timings` object with no
 * zone; they read as a miss so the next request refetches and stores both.
 */
export function parseCachedPrayerTimes(raw: string | null): CachedPrayerTimes | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedPrayerTimes> | null;
    if (!parsed || parsed.v !== 2) return null;
    if (!parsed.timings || typeof parsed.timings !== 'object') return null;
    const timezone = typeof parsed.timezone === 'string' ? parsed.timezone : null;
    return { v: 2, timings: parsed.timings, timezone };
  } catch {
    return null;
  }
}

function readSessionTimings(key: string): CachedPrayerTimes | null {
  try {
    return parseCachedPrayerTimes(window.sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function writeSessionTimings(key: string, timings: Record<string, string>, timezone: string | null): void {
  const entry: CachedPrayerTimes = { v: 2, timings, timezone };
  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // private mode / quota: the next request simply fetches again
  }
}

/**
 * Fetch the timings for a location preference. Plain effects on purpose: the
 * prayer surfaces (Home, Roznama, /muslim) never used react-query, and the
 * Board widget — which does — calls `fetchPrayerTimes` through its own query.
 */
export function usePrayerTimes(
  location: LocationPreference,
  method: number,
  options: PrayerTimesOptions = {},
): PrayerTimesState {
  const { enabled = true, timeoutMs = 10_000, sessionCache = false, initialData = null } = options;
  const [timings, setTimings] = useState<Record<string, string> | null>(() => initialData?.timings ?? null);
  const [hijri, setHijri] = useState<PrayerHijri | null>(() => initialData?.hijri ?? null);
  const [loading, setLoading] = useState(() => enabled && !initialData?.timings);
  const [error, setError] = useState<PrayerTimesError | null>(null);
  const [serverZone, setServerZone] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const params = prayerTimesParams(location, method);
  const requestKey = JSON.stringify(params);
  const cacheKey = sessionCache ? prayerTimesCacheKey(location, method) : null;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // A zone belongs to one request; the fallback covers the gap.
    setServerZone(null);

    if (cacheKey !== null) {
      const cached = readSessionTimings(cacheKey);
      if (cached) {
        setTimings(cached.timings);
        setServerZone(cached.timezone);
        setLoading(false);
        setError(null);
        return;
      }
    }

    const ctrl = new AbortController();
    let superseded = false;
    let timedOut = false;
    const timer =
      timeoutMs === null ? null : window.setTimeout(() => {
        timedOut = true;
        ctrl.abort();
      }, timeoutMs);

    setLoading(true);
    setError(null);

    fetchPrayerTimes(paramsRef.current, ctrl.signal)
      .then((result) => {
        if (superseded) return;
        setTimings(result.timings);
        setHijri(result.hijri);
        setServerZone(result.timezone ?? null);
        if (cacheKey !== null) writeSessionTimings(cacheKey, result.timings, result.timezone ?? null);
      })
      .catch((cause: unknown) => {
        if (superseded) return;
        // An abort is this hook's own timeout: the surface owns the copy for it.
        const aborted = timedOut || (cause instanceof Error && cause.name === 'AbortError');
        const message = aborted ? '' : apiErrorMessage(cause, 'فشل جلب مواقيت الصلاة');
        setError({ message, timedOut: aborted });
      })
      .finally(() => {
        if (superseded) return;
        if (timer !== null) window.clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      superseded = true;
      if (timer !== null) window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [requestKey, cacheKey, enabled, timeoutMs, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const timeZone = prayerTimeZone(location, serverZone);

  return { timings, hijri, loading, error, timeZone, reload };
}
