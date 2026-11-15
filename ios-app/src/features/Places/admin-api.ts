import { api, type ApiClient, type ApiRequestOptions } from '../../api';
import { decodeAdminPlace, decodeReport } from './admin-model';
import { decodePhoto, pageOf, positiveId } from './model';
import { assetUrl, record } from '../../platform/validation';

function acknowledgedState(value: unknown, id: number, expected: string): void {
  const row = record(value);
  if (row.id !== id || row.status !== expected) throw new Error('لم يتم تأكيد حالة العنصر. أعد تحميل القائمة.');
}
function acknowledgedPhoto(value: unknown, id: number): void {
  const row = record(value);
  if (row.id !== id || !assetUrl(row.thumb_url) || !assetUrl(row.display_url)) throw new Error('لم يتم تأكيد تحديث الصورة.');
}
function deleted(value: unknown): void { if (value !== null) throw new Error('لم يتم تأكيد حذف العنصر.'); }

export function placesAdminApi(stamp: number, client: Pick<ApiClient, 'request'> = api) {
  const options = (extra: ApiRequestOptions = {}): ApiRequestOptions => ({ ...extra, authenticated: true, sessionGeneration: stamp });
  const write = (path: string, method: 'POST' | 'DELETE', decode: (value: unknown) => void, body?: ApiRequestOptions['body']) =>
    client.request(path, decode, options({ method, ...(body ? { body } : {}) }));
  return {
    list: (status: string, page: number, signal: AbortSignal) => client.request('admin/places', value => pageOf(value, decodeAdminPlace), options({ signal, params: { status, page } })),
    reports: (status: string, page: number, signal: AbortSignal) => client.request('admin/place-reports', value => pageOf(value, decodeReport), options({ signal, params: { status, page } })),
    update: (id: number, patch: Record<string, string | number>) => client.request(`admin/places/${positiveId(id)}`, decodeAdminPlace, options({ method: 'PATCH', body: patch })),
    approve: (id: number) => write(`admin/places/${positiveId(id)}/approve`, 'POST', value => acknowledgedState(value, id, 'approved')),
    reject: (id: number, reason: string) => write(`admin/places/${positiveId(id)}/reject`, 'POST', value => acknowledgedState(value, id, 'rejected'), { reason: reason.trim() || null }),
    remove: (id: number) => write(`admin/places/${positiveId(id)}`, 'DELETE', deleted),
    resolve: (id: number, action: 'dismiss' | 'unpublish') => write(`admin/place-reports/${positiveId(id)}/resolve`, 'POST', value => acknowledgedState(value, id, action === 'dismiss' ? 'dismissed' : 'resolved'), { action }),
    addPhoto: (id: number, body: FormData) => client.request(`admin/places/${positiveId(id)}/photos`, decodePhoto, options({ method: 'POST', body })),
    rotatePhoto: (id: number) => write(`admin/place-photos/${positiveId(id)}/rotate`, 'POST', value => acknowledgedPhoto(value, id)),
    replacePhoto: (id: number, body: FormData) => write(`admin/place-photos/${positiveId(id)}/replace`, 'POST', value => acknowledgedPhoto(value, id), body),
    removePhoto: (id: number) => write(`admin/place-photos/${positiveId(id)}`, 'DELETE', deleted)
  };
}
// PORT STATUS: source resources/js/Domain/places/api.ts; confidence medium; todos 1 isolated native multipart and moderator request proof.
