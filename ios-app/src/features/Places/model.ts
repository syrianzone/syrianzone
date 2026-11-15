import { decodePlace, type Coordinate, type Page, type Place } from '../../domain';
import { array, assetUrl, record, text } from '../../platform/validation';
import facts from '../../../../resources/data/syria.json';
import places from '../../../../resources/data/places.json';
import { nonnegative, pageOf, positiveId } from '../../platform/entity-data';
import { decodeCoordinate } from '../../platform/geo';
export { nonnegative, pageOf, positiveId } from '../../platform/entity-data';
export { decodeCoordinate, inSyria, parseCoordinates } from '../../platform/geo';

export type PlaceStatus = 'pending' | 'approved' | 'rejected';
export interface PlacePhoto { id: number; thumbnail: string; url: string; sort: number }
export interface Contributor { id: number; name: string; avatar: string | null; level: number; points: number }
export interface FullPlace extends Place { status: PlaceStatus; user: Contributor; photos: PlacePhoto[]; savedByMe: boolean; createdAt: string }
export interface OwnPlace extends Place { status: PlaceStatus; rejectionReason: string | null; createdAt: string }
export interface PlacePin { id: number; name: string; category: string; userId: number; thumbnail: string | null; coordinate: Coordinate }
export interface WallPhoto { id: number; thumbnail: string; url: string; place: { id: number; name: string; category: string; coordinate: Coordinate } }
export interface GeoSuggestion { name: string; address: string; coordinate: Coordinate }
export interface PickedPhoto { uri: string; name: string; mimeType: string; size: number; width: number; height: number }
export interface ContributionDraft { name: string; category: string; description: string; coordinate: Coordinate; photos: PickedPhoto[] }
export const reportReasons = [{ value: 'inappropriate', label: 'محتوى مسيء أو غير لائق' }, { value: 'spam', label: 'محتوى مزعج أو إعلاني' }, { value: 'wrong_info', label: 'معلومات خاطئة' }, { value: 'duplicate', label: 'مكان مكرر' }, { value: 'other', label: 'سبب آخر' }] as const;
export type ReportReason = typeof reportReasons[number]['value'];
export function placeStatus(value: unknown): PlaceStatus {
  if (value !== 'pending' && value !== 'approved' && value !== 'rejected') throw new Error('حالة المكان غير صالحة.');
  return value;
}
function requiredAsset(value: unknown): string { const url = assetUrl(value); if (!url) throw new Error('رابط الصورة غير صالح.'); return url; }
function boolean(value: unknown): boolean { if (typeof value !== 'boolean') throw new Error('بيانات غير صالحة.'); return value; }
function category(value: unknown): string { const result = text(value); if (!places.categories.some(item => item.key === result)) throw new Error('التصنيف غير صالح.'); return result; }
export function decodePhoto(value: unknown): PlacePhoto {
  const row = record(value);
  return { id: positiveId(row.id), thumbnail: requiredAsset(row.thumb_url), url: requiredAsset(row.display_url), sort: nonnegative(row.sort) };
}
export function decodeFullPlace(value: unknown): FullPlace {
  const row = record(value), user = record(row.user);
  return { ...decodePlace(row), status: placeStatus(row.status), savedByMe: boolean(row.saved_by_me), createdAt: text(row.created_at),
    user: { id: positiveId(user.id), name: text(user.name), avatar: assetUrl(user.avatar_url), level: positiveId(user.level), points: nonnegative(user.points) }, photos: array(row.photos).map(decodePhoto) };
}
export function deviceSnapshot(place: Place & { status?: PlaceStatus }): Place {
  if (place.status !== undefined && place.status !== 'approved') throw new Error('لا يمكن حفظ مكان غير منشور في محفوظات الجهاز.');
  return { id: place.id, name: place.name, category: place.category, description: place.description, coordinate: { ...place.coordinate }, thumbnail: place.thumbnail, savesCount: place.savesCount };
}
export function decodeOwnPlace(value: unknown): OwnPlace {
  const row = record(value);
  return { ...decodePlace(row), status: placeStatus(row.status), rejectionReason: row.rejection_reason == null ? null : text(row.rejection_reason), createdAt: text(row.created_at) };
}
export function decodePlacePins(value: unknown): PlacePin[] {
  const collection = record(value);
  if (collection.type !== 'FeatureCollection') throw new Error('بيانات الخريطة غير صالحة.');
  return array(collection.features).map(item => {
    const feature = record(item), geometry = record(feature.geometry), row = record(feature.properties), point = array(geometry.coordinates);
    if (feature.type !== 'Feature' || geometry.type !== 'Point' || point.length !== 2) throw new Error('نقطة الخريطة غير صالحة.');
    return { id: positiveId(row.id), name: text(row.name), category: category(row.category), userId: positiveId(row.user_id), thumbnail: assetUrl(row.thumb_url), coordinate: decodeCoordinate(point[1], point[0]) };
  });
}
export function decodePhotoPage(value: unknown): Page<WallPhoto> {
  return pageOf(value, item => {
    const row = record(item), place = record(row.place);
    return { id: positiveId(row.id), thumbnail: requiredAsset(row.thumb_url), url: requiredAsset(row.display_url), place: { id: positiveId(place.id), name: text(place.name), category: category(place.category), coordinate: decodeCoordinate(place.lat, place.lng) } };
  });
}
export function decodeGeocoder(value: unknown): GeoSuggestion[] {
  return array(record(value).suggestions).map(item => { const row = record(item); return { name: text(row.name), address: text(row.address, ''), coordinate: decodeCoordinate(row.lat, row.lng) }; });
}
export function validatePhoto(photo: PickedPhoto): PickedPhoto {
  if (!photo.uri.startsWith('file://') || !photo.name || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType)) throw new Error('الصورة يجب أن تكون بصيغة JPG أو PNG أو WebP.');
  if (!Number.isFinite(photo.size) || photo.size < 1 || photo.size > 12 * 1024 * 1024) throw new Error('حجم الصورة يجب ألا يتجاوز 12 ميغابايت.');
  if (![photo.width, photo.height].every(edge => Number.isInteger(edge) && edge >= 200 && edge <= 6000)) throw new Error('أبعاد الصورة يجب أن تكون بين 200x200 و6000x6000 بكسل.');
  return photo;
}
export function acceptPhotos(photos: readonly PickedPhoto[], available: number): { accepted: PickedPhoto[]; errors: string[] } {
  const accepted: PickedPhoto[] = [], errors: string[] = [];
  if (!Number.isInteger(available) || available < 0 || available > 10) throw new Error('عدد الصور المتاحة غير صالح.');
  for (const photo of photos) {
    try {
      validatePhoto(photo);
      if (accepted.length >= available) errors.push(`${photo.name}: الحد الأقصى عشر صور للمكان.`);
      else accepted.push(photo);
    } catch (reason) { errors.push(`${photo.name}: ${reason instanceof Error ? reason.message : 'تعذر اختيار الصورة.'}`); }
  }
  return { accepted, errors };
}
export function validateDetails(input: { name: string; category: string; description: string }): { name: string; category: string; description: string } {
  const name = input.name.trim(), description = input.description.trim();
  if (!name || [...name].length > 160) throw new Error('أدخل اسم المكان، حتى 160 حرفاً.');
  if ([...description].length < 20 || [...description].length > 1000) throw new Error('وصف المكان يجب أن يكون بين 20 و1000 حرف.');
  return { name, category: category(input.category), description };
}
export function validateDetailsPatch(input: Partial<{ name: string; category: string; description: string }>): Partial<{ name: string; category: string; description: string }> {
  const patch: typeof input = {};
  if (input.name !== undefined) { const value = input.name.trim(); if (!value || [...value].length > 160) throw new Error('أدخل اسم المكان، حتى 160 حرفاً.'); patch.name = value; }
  if (input.category !== undefined) patch.category = category(input.category);
  if (input.description !== undefined) { const value = input.description.trim(); if ([...value].length < 20 || [...value].length > 1000) throw new Error('وصف المكان يجب أن يكون بين 20 و1000 حرف.'); patch.description = value; }
  if (!Object.keys(patch).length) throw new Error('لا توجد تعديلات.');
  return patch;
}
export function contributionFieldErrors(input: ContributionDraft): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  if (!input.name.trim() || [...input.name.trim()].length > 160) errors.name = ['أدخل اسم المكان، حتى 160 حرفاً.'];
  if (!places.categories.some(item => item.key === input.category)) errors.category = ['اختر التصنيف.'];
  if ([...input.description.trim()].length < 20 || [...input.description.trim()].length > 1000) errors.description = ['وصف المكان يجب أن يكون بين 20 و1000 حرف.'];
  if (!Number.isFinite(input.coordinate.latitude) || input.coordinate.latitude < facts.bbox.lat_min || input.coordinate.latitude > facts.bbox.lat_max) errors.lat = ['حدد خط عرض داخل حدود سوريا.'];
  if (!Number.isFinite(input.coordinate.longitude) || input.coordinate.longitude < facts.bbox.lng_min || input.coordinate.longitude > facts.bbox.lng_max) errors.lng = ['حدد خط طول داخل حدود سوريا.'];
  if (!input.photos.length || input.photos.length > 10) errors.photos = ['أضف من صورة واحدة إلى عشر صور.'];
  input.photos.forEach((photo, index) => { try { validatePhoto(photo); } catch (reason) { errors[`photos.${index}`] = [reason instanceof Error ? reason.message : 'تحقق من الصورة.']; } });
  return errors;
}
export function validateContribution(input: ContributionDraft): ContributionDraft {
  const firstError = Object.values(contributionFieldErrors(input))[0]?.[0];
  if (firstError) throw new Error(firstError);
  return { ...validateDetails(input), coordinate: input.coordinate, photos: input.photos.map(validatePhoto) };
}
// PORT STATUS: source resources/js/Domain/places/types.ts and Pages/Places/_components/FilterBar.tsx,PhotoPicker.tsx; confidence high; todos 0.
