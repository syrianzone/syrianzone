import type { Coordinate, Page } from '../../domain';
import { array, assetUrl, finiteNumber, record, text } from '../../platform/validation';
import { externalUrl } from '../../platform/links-model';
import { pageOf, positiveId } from '../../platform/entity-data';
import { decodeCoordinate } from '../../platform/geo';

export interface Hotel { id: number; name: string; nameAr: string; city: string; cityAr: string; slug: string; coordinate: Coordinate | null; stars: number | null; rate: number | null; currency: string; thumbnail: string | null; source: string }
export interface HotelDetail extends Hotel { description: string; descriptionAr: string; images: string[] }
const optionalNumber = (value: unknown): number | null => value == null ? null : finiteNumber(value);
export function decodeHotelSummary(value: unknown): Hotel {
  const row = record(value), stars = optionalNumber(row.star_rating), rate = optionalNumber(row.now_show_rate);
  if (stars !== null && (!Number.isInteger(stars) || stars < 1 || stars > 5) || rate !== null && rate < 0) throw new Error('بيانات تصنيف الفندق أو السعر غير صالحة.');
  return { id: positiveId(row.id), name: text(row.name), nameAr: text(row.name_ar, ''), city: text(row.city), cityAr: text(row.city_ar, ''), slug: text(row.slug),
    coordinate: row.lat == null || row.lng == null ? null : decodeCoordinate(row.lat, row.lng), stars, rate, currency: text(row.currency), thumbnail: assetUrl(row.thumb_url), source: externalUrl(text(row.source_url)) };
}
export function decodeHotel(value: unknown): HotelDetail {
  const row = record(value);
  return { ...decodeHotelSummary(row), description: text(row.description, ''), descriptionAr: text(row.description_ar, ''), images: array(row.images ?? []).map(item => { const url = assetUrl(item); if (!url) throw new Error('رابط صورة الفندق غير صالح.'); return url; }) };
}
export function decodeHotelPage(value: unknown): Page<Hotel> { return pageOf(value, decodeHotelSummary); }
export { decodeHotelPins } from '../../platform/hotel-map';
// PORT STATUS: source resources/js/Domain/places/types.ts and app/Http/Controllers/HotelController.php; confidence high; todos 0.
