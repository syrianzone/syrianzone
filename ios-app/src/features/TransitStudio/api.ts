import { api, ApiError, type ApiClient, type ApiRequestOptions } from '../../api';
import { array, record, text } from '../../platform/validation';
import { positiveId } from '../../platform/entity-data';
import { entityId } from '../../platform/transit-model';
import { buildPayload, decodeStudioDraft, type StudioDraft } from './model';

const session = (generation: number, signal?: AbortSignal): ApiRequestOptions => ({ authenticated: true, sessionGeneration: generation, ...(signal ? { signal } : {}) });
const key = (id: string | number): string => encodeURIComponent(String(entityId(id)));
export interface StudioSummary { id: number; name: string; cityId: string; status: 'pending' | 'approved' | 'rejected'; rejection: string | null }
export function createStudioClient(client: Pick<ApiClient, 'request'> = api) {
  return {
    async save(draft: StudioDraft, generation?: number): Promise<number> {
      if ((draft.editingDraftId !== null || draft.editingRouteId !== null) && generation === undefined) throw new Error('يلزم تسجيل الدخول لتعديل مسار.');
      const body = buildPayload(draft);
      return client.request(draft.editingDraftId !== null ? `transit/studio/routes/${positiveId(draft.editingDraftId)}` : 'transit/studio/routes', value => {
        const row = record(value), id = positiveId(row.id);
        if (row.status !== 'pending' || draft.editingDraftId !== null && id !== draft.editingDraftId) throw new Error('لم يؤكد الخادم حفظ المسودة للمراجعة.');
        return id;
      }, { ...(generation === undefined ? {} : session(generation)), method: draft.editingDraftId !== null ? 'PUT' : 'POST', body });
    },
    async load(id: string, generation: number, signal: AbortSignal, kind: 'draft' | 'route' | 'auto' = 'auto'): Promise<StudioDraft> {
      if (kind === 'route') return client.request(`transit/studio/routes/${key(id)}/from-route`, decodeStudioDraft, session(generation, signal));
      try { return await client.request(`transit/studio/routes/${key(id)}`, decodeStudioDraft, session(generation, signal)); }
      catch (error) {
        if (kind !== 'auto' || !(error instanceof ApiError) || error.status !== 404 || signal.aborted) throw error;
        return client.request(`transit/studio/routes/${key(id)}/from-route`, decodeStudioDraft, session(generation, signal));
      }
    },
    list: (generation: number, signal: AbortSignal) => client.request('transit/studio/routes', value => array(record(value).data).map(item => {
      const row = record(item), status = row.status;
      if (status !== 'pending' && status !== 'approved' && status !== 'rejected') throw new Error('حالة المسودة غير صالحة.');
      return { id: positiveId(row.id), name: text(row.name_ar), cityId: String(entityId(row.city_id)), status, rejection: row.rejection_reason == null ? null : text(row.rejection_reason) } satisfies StudioSummary;
    }), session(generation, signal)),
    withdraw: (id: number, generation: number) => client.request(`transit/studio/routes/${positiveId(id)}`, value => { if (record(value).ok !== true) throw new Error('لم يؤكد الخادم سحب المسودة.'); }, { ...session(generation), method: 'DELETE' })
  };
}
export const studioClient = createStudioClient();
// PORT STATUS: source resources/js/Pages/Transit/_lib/api.ts and app/Http/Controllers/TransitStudioController.php; confidence medium; todos 1 isolated draft load/save/withdraw integration verification.
