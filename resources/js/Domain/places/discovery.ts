import { api as client, API_V1 } from '@/Lib/api';
import type { Paginated } from './types';

export type GuidesSort = 'points' | 'submissions' | 'saves' | 'recent';

export interface Guide {
  rank: number;
  user_id: number;
  name: string;
  avatar_url: string | null;
  approved_count: number;
  saves_total: number;
  recent_count: number;
  points: number;
  level: number;
}

export interface GridPhoto {
  id: number;
  thumb_url: string;
  display_url: string;
  place: { id: number; name: string; category: string; lat: number; lng: number };
}

export const discovery = {
  async guides(sort: GuidesSort): Promise<{ sort: GuidesSort; guides: Guide[] }> {
    return client.get(`${API_V1}/guides`, { params: { sort } });
  },

  async gridPhotos(page: number, userId?: number): Promise<Paginated<GridPhoto>> {
    return client.get(`${API_V1}/places/photos`, { params: { page, user_id: userId } });
  },
};
