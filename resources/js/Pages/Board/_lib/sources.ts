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

  // proxied through the app for the same reason as the weather worker
  async recipeOfTheDay(): Promise<Recipe> {
    const { data } = await axios.get('/api/recipe-of-the-day');
    return data.recipe;
  },
};
