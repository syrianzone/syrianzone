import { decodePlace } from '../../domain';
import { array, assetUrl, record, text } from '../../platform/validation';
import { decodePhoto, inSyria, placeStatus, positiveId, reportReasons, validateDetailsPatch, type FullPlace, type ReportReason } from './model';

export interface AdminPlace extends Omit<FullPlace, 'user'> { user: { id: number; name: string; avatar: string | null }; rejectionReason: string | null }
export interface PlaceEdit { name: string; category: string; description: string; lat: string; lng: string }
export interface AdminReport {
  id: number; reason: ReportReason; details: string | null; status: 'open' | 'resolved' | 'dismissed'; createdAt: string;
  user: { id: number; name: string }; place: { id: number; name: string; status: FullPlace['status'] };
}
export const photoBounds = { maxBytes: 12 * 1024 * 1024, minWidth: 200, minHeight: 200, maxWidth: 6000, maxHeight: 6000 };
export function decodeAdminPlace(value: unknown): AdminPlace {
  const row = record(value), user = record(row.user);
  if (typeof row.saved_by_me !== 'boolean') throw new Error('بيانات الحفظ غير صالحة.');
  return { ...decodePlace(row), status: placeStatus(row.status), savedByMe: row.saved_by_me, createdAt: text(row.created_at),
    user: { id: positiveId(user.id), name: text(user.name), avatar: assetUrl(user.avatar_url) }, photos: array(row.photos).map(decodePhoto),
    rejectionReason: row.rejection_reason == null ? null : text(row.rejection_reason) };
}
export function decodeReport(value: unknown): AdminReport {
  const row = record(value), user = record(row.user), place = record(row.place);
  const reason = reportReasons.find(item => item.value === row.reason)?.value;
  if (!reason || (row.status !== 'open' && row.status !== 'resolved' && row.status !== 'dismissed')) throw new Error('بيانات البلاغ غير صالحة.');
  return { id: positiveId(row.id), reason, details: row.details == null ? null : text(row.details), status: row.status,
    createdAt: text(row.created_at), user: { id: positiveId(user.id), name: text(user.name) },
    place: { id: positiveId(place.id), name: text(place.name), status: placeStatus(place.status) } };
}
export function adminPlacePatch(place: AdminPlace, form: PlaceEdit): Record<string, string | number> {
  const latitude = Number(form.lat), longitude = Number(form.lng);
  if (!inSyria({ latitude, longitude })) throw new Error('الإحداثيات خارج حدود سوريا.');
  const fields: Partial<Pick<PlaceEdit, 'name' | 'category' | 'description'>> = {};
  if (form.name !== place.name) fields.name = form.name;
  if (form.category !== place.category) fields.category = form.category;
  if (form.description !== place.description) fields.description = form.description;
  return { ...(Object.keys(fields).length ? validateDetailsPatch(fields) : {}),
    ...(latitude !== place.coordinate.latitude ? { lat: latitude } : {}), ...(longitude !== place.coordinate.longitude ? { lng: longitude } : {}) };
}
// PORT STATUS: source resources/js/Pages/Admin/Places/EditPlaceDialog.tsx and resources/js/Domain/places/types.ts; confidence high; todos 0.
