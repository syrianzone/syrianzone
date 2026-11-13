import { api as client, API_ROOT, API_V1 } from '@/Lib/api';
import type {
  CandidateArchiveInput,
  CandidateInput,
  Poll,
  PollDetails,
  PollGroup,
} from './types';

/**
 * Poll resources. The public vote path is passed in by the page (`TierBoard`),
 * so it is not named here; everything the admin editors and the dashboard
 * mutate goes through this one client.
 */
export const pollsApi = {
  details(id: string): Promise<PollDetails> {
    return client.get(`${API_ROOT}/polls/${id}`, { params: { include_archived: 1 } });
  },

  create(input: { title: string; slug: string; timezone: string; is_active: boolean }): Promise<Poll> {
    return client.post(`${API_ROOT}/polls`, input);
  },

  update(id: string, input: { title: string; slug: string; is_active: boolean }): Promise<Poll> {
    return client.put(`${API_ROOT}/polls/${id}`, input);
  },

  remove(id: string): Promise<void> {
    return client.delete(`${API_ROOT}/polls/${id}`);
  },

  /** The public ranking; the page owns the shape because it renders it. */
  leaderboard<T>(slug: string, status: string): Promise<T> {
    return client.get<T>(`${API_ROOT}/polls/${slug}/leaderboard`, { params: { status } });
  },

  createGroup(input: { poll_id: string; name: string }): Promise<PollGroup> {
    return client.post(`${API_ROOT}/candidate-groups`, input);
  },

  removeGroup(id: string): Promise<void> {
    return client.delete(`${API_ROOT}/candidate-groups/${id}`);
  },

  setDefaultGroup(id: string): Promise<void> {
    return client.post(`${API_ROOT}/candidate-groups/${id}/default`);
  },

  setGroupActive(id: string, isActive: boolean): Promise<PollGroup> {
    return client.patch(`${API_ROOT}/candidate-groups/${id}`, { is_active: isActive });
  },

  reorderGroups(groups: Array<{ id: string; sort_order: number }>): Promise<void> {
    return client.post(`${API_ROOT}/candidate-groups/reorder`, { groups });
  },

  createCandidate(input: CandidateInput): Promise<void> {
    return client.post(`${API_ROOT}/candidates`, input);
  },

  updateCandidate(id: string, input: CandidateInput): Promise<void> {
    return client.put(`${API_ROOT}/candidates/${id}`, input);
  },

  removeCandidate(id: string): Promise<void> {
    return client.delete(`${API_ROOT}/candidates/${id}`);
  },

  archiveCandidate(id: string, input: CandidateArchiveInput): Promise<void> {
    return client.patch(`${API_ROOT}/candidates/${id}/archive`, input);
  },

  restoreCandidate(id: string): Promise<void> {
    return client.patch(`${API_ROOT}/candidates/${id}/restore`);
  },

  /** Candidate images go to the shared asset store, not to a poll endpoint. */
  uploadImage(file: File): Promise<{ url: string }> {
    const form = new FormData();
    form.append('file', file);
    form.append('folder', 'candidates');
    return client.post(`${API_V1}/admin/assets/upload`, form);
  },
};
