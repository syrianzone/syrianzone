import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

import { apiOrigin } from '@/lib/env';
import { fetchWeather, type WeatherSummary } from '@/lib/home/widgets';
import { governorates, type PrayerTimes } from '@/lib/ported/home';

export interface CachedValue<T> {
  cached: boolean;
  value: T;
}

export interface RoznamaPrayerSchedule {
  hijriDate: string;
  timings: PrayerTimes;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const CACHE_PREFIX = 'sz-roznama-v1';
const REQUEST_TIMEOUT_MS = 12_000;

const PRAYER_KEYS = [
  'Fajr',
  'Sunrise',
  'Dhuhr',
  'Asr',
  'Maghrib',
  'Isha',
] as const;

const weatherSchema = z.object({
  description: z.string(),
  icon: z.string(),
  temperature: z.number(),
});

const prayerTimesSchema = z.object({
  Asr: z.string().optional(),
  Dhuhr: z.string().optional(),
  Fajr: z.string().optional(),
  Isha: z.string().optional(),
  Maghrib: z.string().optional(),
  Sunrise: z.string().optional(),
});

const prayerScheduleSchema = z.object({
  hijriDate: z.string(),
  timings: prayerTimesSchema,
});

// /api/prayer-times is what the website's widgets read. It resolves "today" in
// Asia/Damascus instead of on the device clock, trims the timezone suffix, and
// caches per governorate, so it is the primary source here too.
const sitePrayerSchema = z.object({
  hijri: z
    .object({ day: z.string(), month: z.string(), year: z.string() })
    .nullable()
    .optional(),
  timings: prayerTimesSchema,
});

const siteWeatherSchema = z.object({
  description: z.string(),
  icon: z.string(),
  temp: z.number(),
});

const aladhanSchema = z.object({
  code: z.number(),
  data: z.object({
    date: z.object({
      hijri: z.object({
        day: z.string(),
        month: z.object({ ar: z.string() }),
        year: z.string(),
      }),
    }),
    timings: prayerTimesSchema,
  }),
});

function governorateCoordinates(governorate: string): {
  lat: number;
  lon: number;
} {
  const selected = governorates.find((item) => item.id === governorate);
  const damascus = governorates[0];
  if (!damascus) {
    throw new Error('Governorate coordinates are unavailable');
  }
  return selected ?? damascus;
}

// The site endpoints answer 422 for a governorate outside their fixed list, so a
// stale stored preference must not take the whole screen down with it.
function knownGovernorate(governorate: string): string {
  return governorates.some((item) => item.id === governorate)
    ? governorate
    : 'damascus';
}

// Aladhan answers "18:57" on most days and "18:57 (EEST)" on others, and the row
// renders the string as it arrives. PrayerController trims it server-side, so the
// direct fallback has to trim it too or the two sources disagree on screen.
function bareTime(value: string): string {
  const match = /^\d{1,2}:\d{2}/.exec(value.trim());
  return match ? match[0] : value.trim();
}

function normalizeTimings(timings: PrayerTimes): PrayerTimes {
  const normalized: PrayerTimes = {};
  for (const key of PRAYER_KEYS) {
    const value = timings[key];
    if (value) {
      normalized[key] = bareTime(value);
    }
  }
  return normalized;
}

async function readCache<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? schema.parse(JSON.parse(value)) : null;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

function createRequestController(signal?: AbortSignal): {
  cleanup: () => void;
  signal: AbortSignal;
} {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  return {
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    },
    signal: controller.signal,
  };
}

async function fetchJson(
  url: string,
  fetcher: FetchLike,
  signal?: AbortSignal,
): Promise<unknown> {
  const request = createRequestController(signal);
  try {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json' },
      signal: request.signal,
    });
    if (!response.ok) {
      throw new Error('request_failed');
    }
    return await response.json();
  } finally {
    request.cleanup();
  }
}

function localDateKey(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

async function fetchSiteSchedule(
  governorate: string,
  fetcher: FetchLike,
  signal?: AbortSignal,
): Promise<RoznamaPrayerSchedule> {
  const url = `${apiOrigin}/api/prayer-times?governorate=${encodeURIComponent(governorate)}`;
  const payload = sitePrayerSchema.parse(await fetchJson(url, fetcher, signal));
  const timings = normalizeTimings(payload.timings);
  if (!timings.Fajr) {
    throw new Error('prayer_unavailable');
  }
  const hijri = payload.hijri;
  return {
    hijriDate: hijri ? `${hijri.day} ${hijri.month} ${hijri.year}` : '',
    timings,
  };
}

async function fetchAladhanSchedule(
  governorate: string,
  dateKey: string,
  fetcher: FetchLike,
  signal?: AbortSignal,
): Promise<RoznamaPrayerSchedule> {
  const coordinates = governorateCoordinates(governorate);
  const url = new URL(`https://api.aladhan.com/v1/timings/${dateKey}`);
  url.searchParams.set('latitude', String(coordinates.lat));
  url.searchParams.set('longitude', String(coordinates.lon));
  // method 3 is the Muslim World League calculation the website and the backend
  // both ask for, so the fallback cannot quietly change the angles.
  url.searchParams.set('method', '3');
  const payload = aladhanSchema.parse(
    await fetchJson(url.toString(), fetcher, signal),
  );
  if (payload.code !== 200) {
    throw new Error('prayer_unavailable');
  }
  const { hijri } = payload.data.date;
  return {
    hijriDate: `${hijri.day} ${hijri.month.ar} ${hijri.year}`,
    timings: normalizeTimings(payload.data.timings),
  };
}

export async function loadRoznamaPrayerSchedule(
  governorate: string,
  date: Date,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<CachedValue<RoznamaPrayerSchedule>> {
  const id = knownGovernorate(governorate);
  const dateKey = localDateKey(date);
  const cacheKey = `${CACHE_PREFIX}:prayer:${id}:${dateKey}`;
  try {
    const value = await fetchSiteSchedule(id, fetcher, signal);
    await writeCache(cacheKey, value);
    return { cached: false, value };
  } catch {
    // the site proxy is preferred, not required: fall through to Aladhan
  }
  try {
    const value = await fetchAladhanSchedule(id, dateKey, fetcher, signal);
    await writeCache(cacheKey, value);
    return { cached: false, value };
  } catch {
    const cached = await readCache(cacheKey, prayerScheduleSchema);
    if (!cached) {
      throw new Error('prayer_unavailable');
    }
    return { cached: true, value: cached };
  }
}

export async function loadRoznamaWeather(
  governorate: string,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<CachedValue<WeatherSummary>> {
  const id = knownGovernorate(governorate);
  const cacheKey = `${CACHE_PREFIX}:weather:${id}`;
  try {
    const url = `${apiOrigin}/api/weather?governorate=${encodeURIComponent(id)}`;
    const payload = siteWeatherSchema.parse(
      await fetchJson(url, fetcher, signal),
    );
    const value: WeatherSummary = {
      description: payload.description,
      icon: payload.icon,
      temperature: Math.round(payload.temp),
    };
    await writeCache(cacheKey, value);
    return { cached: false, value };
  } catch {
    // the worker stays as the fallback the app already shipped with
  }
  try {
    const coordinates = governorateCoordinates(id);
    const value = await fetchWeather(coordinates.lat, coordinates.lon, signal);
    await writeCache(cacheKey, value);
    return { cached: false, value };
  } catch {
    const cached = await readCache(cacheKey, weatherSchema);
    if (!cached) {
      throw new Error('weather_unavailable');
    }
    return { cached: true, value: cached };
  }
}
