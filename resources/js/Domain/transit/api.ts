import { api as client, API_V1 } from '@/Lib/api';
import type { TransitCity } from './types';

/**
 * Transit actions that more than one surface performs: the dashboard moderates
 * route drafts and withdraws studio submissions, the transit admin does the
 * same from its own screen, and the shell lists the cities. The page-level
 * transit client builds on these.
 */

export interface RouteDraftDecision {
  route?: { id: string; city_id: string };
}

/** `GET /api/v1/cities`: the live city list with the published-route counts. */
export function transitCities(signal?: AbortSignal): Promise<TransitCity[]> {
  return client.get(`${API_V1}/cities`, { signal });
}

export const transitAdminApi = {
  approveDraft(id: number, colorIndex?: number): Promise<RouteDraftDecision> {
    return client.post(`${API_V1}/admin/route-drafts/${id}/approve`, { color_index: colorIndex });
  },

  rejectDraft(id: number, reason: string | null): Promise<RouteDraftDecision> {
    return client.post(`${API_V1}/admin/route-drafts/${id}/reject`, { reason });
  },

  deleteStudioRoute(id: number): Promise<unknown> {
    return client.delete(`${API_V1}/studio/routes/${id}`);
  },
};
