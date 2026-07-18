import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

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

export async function loadRoznamaWeather(
  governorate: string,
  signal?: AbortSignal,
): Promise<CachedValue<WeatherSummary>> {
  const cacheKey = `${CACHE_PREFIX}:weather:${governorate}`;
  const coordinates = governorateCoordinates(governorate);
  try {
    const value = await fetchWeather(
      coordinates.lat,
      coordinates.lon,
      signal,
    );
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

function localDateKey(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

export async function loadRoznamaPrayerSchedule(
  governorate: string,
  date: Date,
  signal?: AbortSignal,
  fetcher: FetchLike = fetch,
): Promise<CachedValue<RoznamaPrayerSchedule>> {
  const coordinates = governorateCoordinates(governorate);
  const dateKey = localDateKey(date);
  const cacheKey = `${CACHE_PREFIX}:prayer:${governorate}:${dateKey}`;
  const url = new URL(`https://api.aladhan.com/v1/timings/${dateKey}`);
  url.searchParams.set('latitude', String(coordinates.lat));
  url.searchParams.set('longitude', String(coordinates.lon));
  url.searchParams.set('method', '3');
  const request = createRequestController(signal);
  try {
    const response = await fetcher(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: request.signal,
    });
    if (!response.ok) {
      throw new Error('prayer_unavailable');
    }
    const payload = z
      .object({
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
      })
      .parse(await response.json());
    if (payload.code !== 200) {
      throw new Error('prayer_unavailable');
    }
    const value: RoznamaPrayerSchedule = {
      hijriDate: `${payload.data.date.hijri.day} ${payload.data.date.hijri.month.ar} ${payload.data.date.hijri.year}`,
      timings: payload.data.timings,
    };
    await writeCache(cacheKey, value);
    return { cached: false, value };
  } catch {
    const cached = await readCache(cacheKey, prayerScheduleSchema);
    if (!cached) {
      throw new Error('prayer_unavailable');
    }
    return { cached: true, value: cached };
  } finally {
    request.cleanup();
  }
}
