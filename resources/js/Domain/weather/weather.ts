import { useEffect, useState } from 'react';
import { api as client } from '@/Lib/api';
import { resolveWeatherPoint, type LocationPreference } from '../location/preference';

/**
 * `/api/weather` for the user's location, and the one display vocabulary for it.
 *
 * Only the current conditions are typed here: Home and Roznama render
 * temperature, Arabic description and an icon at their own sizes. The board's
 * weather widget asks the endpoint by governorate slug (not by the user's
 * resolved point) and adds its own forecast strip, but words the conditions and
 * the forecast codes from this module so one condition cannot print two ways.
 */

export interface WeatherResponse {
  governorate: string;
  temp: number;
  description: string;
  icon: string;
  forecast?: WeatherForecastDay[];
}

export interface WeatherForecastDay {
  date: string;
  min: number;
  max: number;
  code: number;
}

export interface WeatherCurrent {
  temp: number;
  description: string;
  /** OpenWeather icon code; `WeatherIcon` maps it. */
  icon: string;
}

/**
 * The English condition descriptions both weather upstreams send, in the wording
 * the surfaces print: OpenWeather wording from `/api/weather`, WMO wording from
 * the Population environmental endpoint (`SyriaClimateService`). Every string an
 * upstream can send is listed here, keyed lower-case; the WMO rows reuse the
 * forecast table's words so one condition cannot print two ways.
 */
const WEATHER_DESCRIPTIONS_AR: Record<string, string> = {
  'clear sky': 'سماء صافية',
  'few clouds': 'غيوم قليلة',
  'scattered clouds': 'غيوم متفرقة',
  'broken clouds': 'غيوم جزئية',
  'shower rain': 'مطر غزير',
  'rain': 'ممطر',
  'thunderstorm': 'عاصفة رعدية',
  'snow': 'مثلج',
  'mist': 'ضباب',
  'overcast clouds': 'غيوم ملبدة',
  'light rain': 'مطر خفيف',
  'moderate rain': 'مطر متوسط',
  'heavy intensity rain': 'مطر غزير',
  'haze': 'ضباب خفيف',
  'fog': 'ضباب كثيف',
  'dust': 'غبار',
  'sand': 'عواصف رملية',
  'mainly clear': 'صافية غالباً',
  'partly cloudy': 'غيوم متفرقة',
  'overcast': 'غائم',
  'depositing rime fog': 'ضباب متجمد',
  'light drizzle': 'رذاذ',
  'moderate drizzle': 'رذاذ',
  'dense drizzle': 'رذاذ كثيف',
  'slight rain': 'مطر خفيف',
  'heavy rain': 'مطر غزير',
  'slight snow fall': 'ثلج خفيف',
  'moderate snow fall': 'ثلج',
  'heavy snow fall': 'ثلج كثيف',
  'slight rain showers': 'زخات',
  'moderate rain showers': 'زخات',
  'violent rain showers': 'زخات غزيرة',
  'thunderstorm with slight hail': 'عاصفة رعدية',
  'thunderstorm with heavy hail': 'عاصفة رعدية',
};

/** WMO codes from the forecast upstream (the server passes the code through raw). */
const FORECAST_CODES_AR: Record<number, string> = {
  0: 'صافية',
  1: 'صافية غالباً',
  2: 'غيوم متفرقة',
  3: 'غائم',
  45: 'ضباب',
  48: 'ضباب',
  51: 'رذاذ',
  53: 'رذاذ',
  55: 'رذاذ كثيف',
  61: 'مطر خفيف',
  63: 'مطر',
  65: 'مطر غزير',
  71: 'ثلج خفيف',
  73: 'ثلج',
  75: 'ثلج كثيف',
  80: 'زخات',
  81: 'زخات',
  82: 'زخات غزيرة',
  95: 'عاصفة رعدية',
  96: 'عاصفة رعدية',
  99: 'عاصفة رعدية',
};

export function weatherDescriptionAr(description: string): string {
  return WEATHER_DESCRIPTIONS_AR[description.trim().toLowerCase()] ?? description;
}

/** A forecast day's WMO code in Arabic; null for a code the table does not know. */
export function weatherCodeAr(code: number): string | null {
  return FORECAST_CODES_AR[code] ?? null;
}

export const WEATHER_URL = '/api/weather';

/** Client-side cache window for the current conditions (sessionStorage, per point). */
const CACHE_TTL_MS = 15 * 60 * 1000;

export function weatherCacheKey(point: { lat: number; lon: number }): string {
  return `sz_weather_${point.lat}_${point.lon}`;
}

interface CachedWeather {
  data: WeatherResponse;
  timestamp: number;
}

function readCached(key: string): WeatherResponse | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedWeather;
    return Date.now() - cached.timestamp < CACHE_TTL_MS ? cached.data : null;
  } catch {
    return null;
  }
}

function writeCached(key: string, data: WeatherResponse): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // private mode / quota: the next mount simply fetches again
  }
}

export function fetchWeather(point: { lat: number; lon: number }): Promise<WeatherResponse> {
  return client.get(WEATHER_URL, { params: { lat: point.lat, lon: point.lon } });
}

export interface UseWeatherOptions {
  enabled?: boolean;
  /** Reuse Home's 15-minute `sessionStorage` entry (Roznama never cached). */
  sessionCache?: boolean;
}

/**
 * Current conditions for the user's location. A plain effect because both
 * callers (Home, Roznama) are plain-effect surfaces.
 */
export function useWeather(
  location: LocationPreference,
  options: UseWeatherOptions = {},
): { weather: WeatherCurrent | null; loading: boolean } {
  const { enabled = true, sessionCache = false } = options;
  const [weather, setWeather] = useState<WeatherCurrent | null>(null);
  const [loading, setLoading] = useState(enabled);

  const point = resolveWeatherPoint(location);
  const key = `${point.lat},${point.lon}`;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let superseded = false;
    const publish = (data: WeatherResponse) => {
      setWeather({
        temp: Math.round(data.temp),
        description: weatherDescriptionAr(data.description),
        icon: data.icon,
      });
    };

    const cacheKey = weatherCacheKey(point);
    if (sessionCache) {
      const cached = readCached(cacheKey);
      if (cached) {
        publish(cached);
        setLoading(false);
        return;
      }
    }

    setLoading(true);
    fetchWeather(point)
      .then((data) => {
        if (superseded) return;
        if (sessionCache) writeCached(cacheKey, data);
        publish(data);
      })
      .catch(() => {
        if (superseded) return;
        // Weather is secondary on every surface that shows it: the page renders
        // without the strip, so a failure is not worth a toast.
        setWeather(null);
      })
      .finally(() => {
        if (!superseded) setLoading(false);
      });

    return () => {
      superseded = true;
    };
  }, [key, enabled, sessionCache]);

  return { weather, loading };
}
