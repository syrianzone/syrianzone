import { api } from '../../api';
import { imageFormData, type ImageUploadAsset } from '../../platform/uploads';
import { assetUrl, record } from '../../platform/validation';
import { decodePoll, decodePollDetails } from './model';
export const candidateImageBounds = { maxBytes: 4 * 1024 * 1024 } as const;
export function pollAdminApi(stamp: number) {
  const auth = { authenticated: true, sessionGeneration: stamp } as const, id = encodeURIComponent;
  return {
    details: (pollId: string, signal?: AbortSignal) => api.request(`admin/polls/${id(pollId)}`, decodePollDetails, { ...auth, params: { include_archived: 1 }, ...(signal ? { signal } : {}) }),
    create: (body: { title: string; slug: string; timezone: string; is_active: boolean }) => api.request('admin/polls', decodePoll, { ...auth, method: 'POST', body }),
    update: (pollId: string, body: { title: string; slug: string; is_active: boolean }) => api.request(`admin/polls/${id(pollId)}`, decodePoll, { ...auth, method: 'PUT', body }),
    remove: (pollId: string) => api.request(`admin/polls/${id(pollId)}`, () => undefined, { ...auth, method: 'DELETE' }),
    createGroup: (body: { poll_id: string; name: string }) => api.request('admin/candidate-groups', record, { ...auth, method: 'POST', body }),
    deleteGroup: (group: string) => api.request(`admin/candidate-groups/${id(group)}`, () => undefined, { ...auth, method: 'DELETE' }),
    defaultGroup: (group: string) => api.request(`admin/candidate-groups/${id(group)}/default`, record, { ...auth, method: 'POST' }),
    activeGroup: (group: string, active: boolean) => api.request(`admin/candidate-groups/${id(group)}`, record, { ...auth, method: 'PATCH', body: { is_active: active } }),
    reorderGroups: (groups: readonly { id: string; sort_order: number }[]) => api.request('admin/candidate-groups/reorder', () => undefined, { ...auth, method: 'POST', body: { groups } }),
    saveCandidate: (candidateId: string | null, body: { poll_id?: string; name: string; title: string | null; x_handle: string | null; image_url: string | null; candidate_group_id: string | null }) => api.request(candidateId ? `admin/candidates/${id(candidateId)}` : 'admin/candidates', record, { ...auth, method: candidateId ? 'PUT' : 'POST', body }),
    deleteCandidate: (candidateId: string) => api.request(`admin/candidates/${id(candidateId)}`, () => undefined, { ...auth, method: 'DELETE' }),
    archiveCandidate: (candidateId: string, body: { term_ended_at: string | null; archive_reason: string | null; successor_id: string | null }) => api.request(`admin/candidates/${id(candidateId)}/archive`, record, { ...auth, method: 'PATCH', body }),
    restoreCandidate: (candidateId: string) => api.request(`admin/candidates/${id(candidateId)}/restore`, record, { ...auth, method: 'PATCH' }),
    upload: (asset: ImageUploadAsset) => { const form = imageFormData('file', asset, candidateImageBounds); form.append('folder', 'candidates'); return api.request('admin/assets/upload', value => { const url = assetUrl(record(value).url); if (!url) throw new Error('لم يتم تأكيد رفع الصورة.'); return url; }, { ...auth, method: 'POST', body: form }); }
  };
}
