import { api, type ApiClient, type ApiRequestOptions } from '../../api';
import { decodePlace, type Coordinate, type Place } from '../../domain';
import { array, record, text } from '../../platform/validation';
import type { ImageUploadAsset, ImageUploadBounds } from '../../platform/upload-model';
import { decodeFullPlace, decodeGeocoder, decodeOwnPlace, decodePhoto, decodePhotoPage, decodePlacePins, inSyria, nonnegative, pageOf, positiveId, reportReasons, validateContribution, validateDetailsPatch, validatePhoto, type PickedPhoto, type ReportReason } from './model';

const session = (generation: number, signal?: AbortSignal): ApiRequestOptions => ({ authenticated: true, sessionGeneration: generation, ...(signal ? { signal } : {}) });
function acknowledgedPending(value: unknown): number { const row = record(value); if (row.status !== 'pending') throw new Error('لم يؤكد الخادم إرسال المكان للمراجعة.'); return positiveId(row.id); }
type ImageAppender = (form: FormData, field: string, asset: ImageUploadAsset, bounds: ImageUploadBounds) => void;
const photoBounds = { maxBytes: 12 * 1024 * 1024, minWidth: 200, minHeight: 200, maxWidth: 6000, maxHeight: 6000 };
const imageAsset = (photo: PickedPhoto): ImageUploadAsset => ({ uri: photo.uri, fileName: photo.name, mimeType: photo.mimeType, fileSize: photo.size, width: photo.width, height: photo.height });
export function createPlacesClient(client: Pick<ApiClient, 'request'> = api, loadImages: () => Promise<ImageAppender> = async () => (await import('../../platform/uploads')).appendImage) {
  return {
    pins: (signal: AbortSignal) => client.request('places/map', decodePlacePins, { signal }),
    list: (params: { q?: string; category?: string; sort?: 'newest' | 'popular'; user_id?: number; page: number }, signal: AbortSignal) => client.request('places', value => pageOf(value, decodePlace), { params, signal }),
    detail: (id: number, signal: AbortSignal, generation?: number) => client.request(`places/${positiveId(id)}`, decodeFullPlace, generation === undefined ? { signal } : session(generation, signal)),
    photos: (page: number, signal: AbortSignal, userId?: number) => client.request('places/photos', decodePhotoPage, { signal, params: { page: positiveId(page), user_id: userId } }),
    geocode: (query: string, signal: AbortSignal) => client.request('places/geocode', decodeGeocoder, { signal, params: { q: query.trim().slice(0, 100) } }),
    nearby: (coordinate: Coordinate, signal: AbortSignal, generation?: number) => client.request('places/nearby', value => array(record(value).places).map(item => {
      const row = record(item); return { ...decodePlace(row), distance: nonnegative(row.distance_m) };
    }), { ...(generation === undefined ? { signal } : session(generation, signal)), params: { lat: coordinate.latitude, lng: coordinate.longitude, radius_km: 0.25, include_pending: generation === undefined ? 0 : 1 } }),
    mine: (page: number, generation: number, signal: AbortSignal) => client.request('my/places', value => pageOf(value, decodeOwnPlace), { ...session(generation, signal), params: { page: positiveId(page) } }),
    saved: (page: number, generation: number, signal: AbortSignal) => client.request('my/saves', value => pageOf<Place>(value, decodePlace), { ...session(generation, signal), params: { page: positiveId(page) } }),
    async save(id: number, saved: boolean, generation: number) {
      return client.request(`places/${positiveId(id)}/save`, value => { const row = record(value); if (typeof row.saved !== 'boolean') throw new Error('لم يؤكد الخادم حفظ المكان.'); return { saved: row.saved, count: nonnegative(row.saves_count) }; }, { ...session(generation), method: saved ? 'POST' : 'DELETE' });
    },
    report(id: number, reason: ReportReason, details: string, generation: number) {
      if (!reportReasons.some(item => item.value === reason) || [...details].length > 1000) throw new Error('تحقق من سبب البلاغ وتفاصيله.');
      return client.request(`places/${positiveId(id)}/report`, value => { const message = text(record(value).message); if (!message.trim()) throw new Error('لم يؤكد الخادم استلام البلاغ.'); return message; }, { ...session(generation), method: 'POST', body: { reason, details: details.trim() || null } });
    },
    async submit(input: Parameters<typeof validateContribution>[0], generation: number) {
      const value = validateContribution(input), body = new FormData();
      body.append('name', value.name); body.append('category', value.category); body.append('description', value.description);
      body.append('lat', String(value.coordinate.latitude)); body.append('lng', String(value.coordinate.longitude));
      const appendImage = await loadImages();
      value.photos.forEach(photo => appendImage(body, 'photos[]', imageAsset(photo), photoBounds));
      return client.request('places', acknowledgedPending, { ...session(generation), method: 'POST', body });
    },
    update(id: number, input: Parameters<typeof validateDetailsPatch>[0], generation: number) { return client.request(`my/places/${positiveId(id)}`, acknowledgedPending, { ...session(generation), method: 'PATCH', body: validateDetailsPatch(input) }); },
    move(id: number, coordinate: Coordinate, generation: number) { if (!inSyria(coordinate)) throw new Error('حدد موقعاً داخل حدود سوريا.'); return client.request(`my/places/${positiveId(id)}/location`, acknowledgedPending, { ...session(generation), method: 'PATCH', body: { lat: coordinate.latitude, lng: coordinate.longitude } }); },
    resubmit: (id: number, generation: number) => client.request(`my/places/${positiveId(id)}/resubmit`, acknowledgedPending, { ...session(generation), method: 'POST' }),
    remove: (id: number, generation: number) => client.request(`my/places/${positiveId(id)}`, value => { if (value !== null) throw new Error('لم يؤكد الخادم الحذف.'); }, { ...session(generation), method: 'DELETE' }),
    async addPhoto(id: number, photo: PickedPhoto, generation: number) { const value = validatePhoto(photo), body = new FormData(), appendImage = await loadImages(); appendImage(body, 'photo', imageAsset(value), photoBounds); return client.request(`my/places/${positiveId(id)}/photos`, response => { const row = record(response); if (row.place_status !== 'pending') throw new Error('لم يتم تأكيد الصورة.'); return decodePhoto(row); }, { ...session(generation), method: 'POST', body }); },
    removePhoto: (id: number, generation: number) => client.request(`my/place-photos/${positiveId(id)}`, value => { const row = record(value); if (positiveId(row.id) !== id || row.place_status !== 'pending') throw new Error('لم يتم تأكيد حذف الصورة.'); }, { ...session(generation), method: 'DELETE' }),
    rotatePhoto: (id: number, generation: number) => client.request(`my/place-photos/${positiveId(id)}/rotate`, value => { const row = record(value); if (positiveId(row.id) !== id) throw new Error('لم يتم تأكيد تدوير الصورة.'); const photo = decodePhoto({ ...row, sort: 0 }); return { id: photo.id, thumbnail: photo.thumbnail, url: photo.url }; }, { ...session(generation), method: 'POST' }),
  };
}
export const placesClient = createPlacesClient();
// PORT STATUS: source resources/js/Domain/places/api.ts; confidence medium; todos 1 isolated authenticated multipart and mutation integration tests.
