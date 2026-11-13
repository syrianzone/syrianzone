import { api as client, API_ROOT } from '@/Lib/api';
import { api } from '@/Domain/places/api';
import type { Guide, GuidesSort, NearbyPlace } from '@/Domain/places/types';
import { fetchPrayerTimes, type PrayerTimesResponse } from '@/Domain/prayer/times';
import { transitCities } from '@/Domain/transit/api';
import { fetchWeatherByGovernorate } from '@/Domain/weather/weather';

// The board's read clients: every widget names the fetcher it uses in its own
// declaration (`source`), and the registry publishes that mapping as
// WIDGET_SOURCES. Places, transit and weather reads reuse the typed clients and
// payload types that already live in `Domain/` rather than restating them here.

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

export const sources = {
  // The city list with its published-route counts: the same client the palette
  // and the 404 grid read.
  transitCities,

  // proxied through the app: the upstream worker only sends CORS headers for the
  // production origin, so calling it from the browser fails everywhere else
  weather: fetchWeatherByGovernorate,

  // every method below is proxied through the app for the same reason as the
  // weather worker: the browser never talks to a third-party host directly
  async answers(limit: number): Promise<AnswerQuestion[]> {
    const data = await client.get<{ items?: AnswerQuestion[] }>(`${API_ROOT}/answers`, { params: { limit } });
    return data.items ?? [];
  },

  async recipeOfTheDay(): Promise<Recipe> {
    const data = await client.get<{ recipe: Recipe }>(`${API_ROOT}/recipe-of-the-day`);
    return data.recipe;
  },

  // plus the "happening today" filter, which the upstream graphql query cannot express
  eventsToday(governorate: string): Promise<TodayEvents> {
    return client.get(`${API_ROOT}/events/today`, { params: { governorate } });
  },

  feed(source: string): Promise<Feed> {
    return client.get(`${API_ROOT}/feed`, { params: { source } });
  },

  // The one client for the endpoint; the widget's react-query supplies caching.
  prayerTimes(params: Record<string, string | number>): Promise<PrayerTimesResponse> {
    return fetchPrayerTimes(params);
  },

  // The two Places reads a board widget needs; the widget folder declares which
  // of these it uses, and the client itself stays with the Places domain.
  async guides(sort: GuidesSort): Promise<{ sort: GuidesSort; guides: Guide[] }> {
    return api.guides(sort);
  },

  async nearby(params: { lat: number; lng: number; radius_km?: number }): Promise<{ places: NearbyPlace[] }> {
    return api.nearby(params);
  },
};
