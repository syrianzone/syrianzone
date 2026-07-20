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
}

// Normalized by the server. `ticket_price` is null for a free event rather than
// 0, so the widget never has to render a price of zero.
export interface TodayEvent {
  id: string;
  name: string;
  url: string;
  address: string;
  is_online: boolean;
  is_free: boolean;
  ticket_price: number | null;
  event_date: string;
  event_time: string | null;
  category: string | null;
  organizer: string | null;
}

export interface TodayEvents {
  governorate: string;
  // true when the governorate had nothing on today and we widened to all of syria
  is_fallback: boolean;
  events: TodayEvent[];
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

  // proxied through the app for the same reason as the weather worker, plus the
  // "happening today" filter, which the upstream query cannot express
  async eventsToday(governorate: string): Promise<TodayEvents> {
    const { data } = await axios.get('/api/events/today', { params: { governorate } });
    return data;
  },
};
