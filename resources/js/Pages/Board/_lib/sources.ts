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

// Normalized server-side from the Apache Answer instance. `url` is an absolute
// permalink on answers.syrian.zone, built by the backend, not by the widget.
export interface AnswerQuestion {
  id: string;
  title: string;
  url: string;
  tags: string[];
  answer_count: number;
  created_at: number;
}

// food.syrian.zone is a sibling app on another origin. The pick is made and
// cached server-side, so every visitor sees the same recipe for the whole day.
export interface Recipe {
  id: number | null;
  name: string;
  url: string;
  image_url: string | null;
  city: string | null;
  time_needed: { label: string; value: string }[];
  difficulty: string | null;
  tags: string[];
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

  // every method below is proxied through the app for the same reason as the
  // weather worker: the browser never talks to a third-party host directly
  async answers(limit: number): Promise<AnswerQuestion[]> {
    const { data } = await axios.get('/api/answers', { params: { limit } });
    return data.items ?? [];
  },

  async recipeOfTheDay(): Promise<Recipe> {
    const { data } = await axios.get('/api/recipe-of-the-day');
    return data.recipe;
  },

  // plus the "happening today" filter, which the upstream graphql query cannot express
  async eventsToday(governorate: string): Promise<TodayEvents> {
    const { data } = await axios.get('/api/events/today', { params: { governorate } });
    return data;
  },

  async feed(source: string): Promise<Feed> {
    const { data } = await axios.get('/api/feed', { params: { source } });
    return data;
  },

  async prayerTimes(governorate: string): Promise<PrayerTimes> {
    const { data } = await axios.get('/api/prayer-times', { params: { governorate } });
    return data;
  },
};
