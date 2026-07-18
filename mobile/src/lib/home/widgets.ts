import { z } from 'zod';

import type { PrayerTimes } from '@/lib/ported/home';

const weatherSchema = z.object({
  main: z.object({ temp: z.number().finite().min(-100).max(100) }),
  weather: z.array(
    z.object({
      description: z.string().trim().min(1).max(120),
      icon: z.string().regex(/^\d{2}[dn]$/),
    }),
  ).min(1),
});

const prayerTime = z
  .string()
  .trim()
  .max(32)
  .regex(/^\d{1,2}:\d{2}(?:\s+\([^)]{1,20}\))?$/);

const prayerSchema = z.object({
  code: z.number().int(),
  data: z.object({
    timings: z.object({
      Asr: prayerTime.optional(),
      Dhuhr: prayerTime.optional(),
      Fajr: prayerTime.optional(),
      Isha: prayerTime.optional(),
      Maghrib: prayerTime.optional(),
      Sunrise: prayerTime.optional(),
    }),
  }),
});

export interface WeatherSummary {
  description: string;
  icon: string;
  temperature: number;
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Widget request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchWeather(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<WeatherSummary> {
  const url = new URL('https://syrianzone.hade-alahmad1.workers.dev/');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  const payload = weatherSchema.parse(await fetchJson(url.toString(), signal));
  const weather = payload.weather[0];
  if (!weather) {
    throw new Error('Weather response has no summary');
  }
  return {
    description: weather.description,
    icon: weather.icon,
    temperature: Math.round(payload.main.temp),
  };
}

export async function fetchPrayerTimes(
  latitude: number,
  longitude: number,
  date: Date,
  signal?: AbortSignal,
): Promise<PrayerTimes> {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const url = new URL(
    `https://api.aladhan.com/v1/timings/${day}-${month}-${date.getFullYear()}`,
  );
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('method', '3');
  const payload = prayerSchema.parse(await fetchJson(url.toString(), signal));
  if (payload.code !== 200) {
    throw new Error('Prayer response was not successful');
  }
  return payload.data.timings;
}
