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

export interface FeedItem {
  title: string;
  link: string | null;
  published_at: string | null;
}

export interface Feed {
  source: string;
  title: string;
  items: FeedItem[];
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

  // proxied through the app for the same reason as the weather worker: no news
  // publisher sends cors headers, so the browser can never fetch a feed directly
  async feed(source: string): Promise<Feed> {
    const { data } = await axios.get('/api/feed', { params: { source } });
    return data;
  },
};
