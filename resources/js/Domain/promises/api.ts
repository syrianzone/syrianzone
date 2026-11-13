import { api as client, API_V1 } from '@/Lib/api';

/**
 * The promises resource: the public vote/report/suggest endpoints and the admin
 * editor, queue and directory lists. One client per resource, so no page spells
 * an `/api/v1/promises...` path.
 */

const PUBLIC = `${API_V1}/promises`;
const ADMIN = `${API_V1}/admin/promises`;

export interface PromiseVoteCounts {
  yes: number;
  no: number;
}

export const promisesApi = {
  // ─── Public ────────────────────────────────────────────────────────────────
  vote(number: number, believes: boolean, deviceId: string | null): Promise<{ votes: PromiseVoteCounts }> {
    return client.post(`${PUBLIC}/${number}/vote`, { believes, device_id: deviceId });
  },

  report(number: number, input: { kind: string; body: string; source_url: string | null }): Promise<{ message?: string }> {
    return client.post(`${PUBLIC}/${number}/reports`, input);
  },

  suggest(input: unknown): Promise<unknown> {
    return client.post(PUBLIC, input);
  },

  // ─── Admin: the promise itself ─────────────────────────────────────────────
  create<T = unknown>(input: unknown): Promise<T> {
    return client.post(ADMIN, input);
  },

  save<T = unknown>(id: string, input: unknown): Promise<T> {
    return client.put(`${ADMIN}/${id}`, input);
  },

  remove(id: string): Promise<void> {
    return client.delete(`${ADMIN}/${id}`);
  },

  /** `publish`, `unpublish` and `reject` share one route shape. */
  moderate<T = unknown>(id: string, action: 'publish' | 'unpublish' | 'reject'): Promise<T> {
    return client.post(`${ADMIN}/${id}/${action}`);
  },

  changeStatus<T = unknown>(id: string, input: unknown): Promise<T> {
    return client.post(`${ADMIN}/${id}/status`, input);
  },

  undoStatusChange<T = unknown>(id: string, updateId: number): Promise<T> {
    return client.delete(`${ADMIN}/${id}/status/${updateId}`);
  },

  reschedule<T = unknown>(id: string, input: unknown): Promise<T> {
    return client.post(`${ADMIN}/${id}/reschedule`, input);
  },

  addUpdate<T = unknown>(id: string, input: unknown): Promise<T> {
    return client.post(`${ADMIN}/${id}/updates`, input);
  },

  removeUpdate<T = unknown>(id: string, updateId: number): Promise<T> {
    return client.delete(`${ADMIN}/${id}/updates/${updateId}`);
  },

  /**
   * Source screenshots and speaker photos share one handler but not one route:
   * the speaker route is guarded by `promises.speakers`, the source one by
   * `promises.edit`, so each editor keeps its own guard.
   */
  uploadImage(file: File, kind: 'speaker' | 'source' = 'source'): Promise<{ url: string }> {
    const form = new FormData();
    form.append('image', file);
    form.append('kind', kind);
    return client.post(kind === 'speaker' ? `${ADMIN}/speakers/upload-image` : `${ADMIN}/upload-image`, form);
  },

  // ─── Admin: sectors ────────────────────────────────────────────────────────
  saveSector(id: string | null, input: { label: string; icon: string | null }): Promise<unknown> {
    return id ? client.put(`${ADMIN}/sectors/${id}`, input) : client.post(`${ADMIN}/sectors`, input);
  },

  toggleSector(id: string): Promise<unknown> {
    return client.patch(`${ADMIN}/sectors/${id}/toggle`);
  },

  reorderSectors(ids: string[]): Promise<unknown> {
    return client.post(`${ADMIN}/sectors/reorder`, { ids });
  },

  removeSector(id: string): Promise<void> {
    return client.delete(`${ADMIN}/sectors/${id}`);
  },

  // ─── Admin: speakers ───────────────────────────────────────────────────────
  addSpeakerByRef(ref: string): Promise<unknown> {
    return client.post(`${ADMIN}/speakers`, { ref });
  },

  saveSpeaker(id: string | null, input: unknown): Promise<unknown> {
    return id ? client.put(`${ADMIN}/speakers/${id}`, input) : client.post(`${ADMIN}/speakers`, input);
  },

  removeSpeaker(id: string): Promise<void> {
    return client.delete(`${ADMIN}/speakers/${id}`);
  },

  reviewSpeaker(id: string, action: 'approve' | 'reject'): Promise<unknown> {
    return client.post(`${ADMIN}/speakers/${id}/${action}`);
  },

  // ─── Admin: the review queue's reports ─────────────────────────────────────
  reviewReport(id: number, action: 'accept' | 'dismiss'): Promise<unknown> {
    return client.post(`${ADMIN}/reports/${id}/${action}`);
  },
};
