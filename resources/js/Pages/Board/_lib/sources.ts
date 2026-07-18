import axios from '@/Lib/axios';

// Board-specific read clients. Places-backed widgets reuse the typed clients
// that already live in Pages/Places/_lib rather than restating them here.

export interface TransitCity {
  id: string;
  name_ar: string;
  name_en: string;
  routeCount: number;
  status: string;
}

export const sources = {
  async transitCities(): Promise<TransitCity[]> {
    const { data } = await axios.get('/api/v1/cities');
    return Array.isArray(data) ? data : (data.cities ?? data.data ?? []);
  },
};
