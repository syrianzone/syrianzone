import axios from '@/Lib/axios';
import type { Paginated } from './types';

export type GuidesSort = 'submissions' | 'saves' | 'recent';

export interface Guide {
  rank: number;
  user_id: number;
  name: string;
  avatar_url: string | null;
  approved_count: number;
  saves_total: number;
  recent_count: number;
}

export interface GridPhoto {
  id: number;
  thumb_url: string;
  display_url: string;
  place: { id: number; name: string; category: string; lat: number; lng: number };
}

const base = '/api/v1';

export const discovery = {
  async guides(sort: GuidesSort): Promise<{ sort: GuidesSort; guides: Guide[] }> {
    const { data } = await axios.get(`${base}/guides`, { params: { sort } });
    return data;
  },

  async gridPhotos(page: number, userId?: number): Promise<Paginated<GridPhoto>> {
    const { data } = await axios.get(`${base}/places/photos`, { params: { page, user_id: userId } });
    return data;
  },
};
