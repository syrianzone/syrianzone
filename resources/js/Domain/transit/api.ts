import { api as client, API_V1 } from '@/Lib/api';

/**
 * Transit actions that more than one surface performs: the dashboard moderates
 * route drafts and withdraws studio submissions, the transit admin does the
 * same from its own screen. The page-level transit client builds on these.
 */

export interface RouteDraftDecision {
  route?: { id: string; city_id: string };
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
