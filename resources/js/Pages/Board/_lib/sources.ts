import axios from '@/Lib/axios';

// Board-specific read clients. Places-backed widgets reuse the typed clients
// that already live in Pages/Places/_lib rather than restating them here.

// The endpoint returns camelCase keys, not the underlying column names.
export interface TransitCity {
  id: string;
  nameAr: string;
  nameEn: string;
  routeCount: number;
  status: string;
}

export interface Weather {
  governorate: string;
  temp: number;
  description: string;
  icon: string;
  // additive: an empty array is a normal answer when the forecast upstream is
  // down, and current conditions still render
  forecast: ForecastDay[];
}

export interface ForecastDay {
  date: string;
  min: number;
  max: number;
  // raw WMO code; the widget owns the arabic labels, as it does for description
  code: number;
}

export interface PrayerTimes {
  governorate: string;
  timings: Record<string, string>;
  hijri: { day: string; month: string; year: string } | null;
}

export const sources = {
  async transitCities(): Promise<TransitCity[]> {
    const { data } = await axios.get('/api/v1/cities');
    return Array.isArray(data) ? data : (data.cities ?? data.data ?? []);
  },

  // proxied through the app: the upstream worker only sends CORS headers for the
  // production origin, so calling it from the browser fails everywhere else
  async weather(governorate: string): Promise<Weather> {
    const { data } = await axios.get('/api/weather', { params: { governorate } });
    return data;
  },

  // also proxied: aladhan's permissive CORS is a policy we do not control, and
  // the weather worker already showed what happens when we depend on one
  async prayerTimes(governorate: string): Promise<PrayerTimes> {
    const { data } = await axios.get('/api/prayer-times', { params: { governorate } });
    return data;
  },
};
