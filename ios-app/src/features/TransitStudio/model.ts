import type { Coordinate } from '../../domain';
import { array, finiteNumber, integer, record, text } from '../../platform/validation';
import facts from '../../../../resources/data/transit.json';
import { decodeCoordinate } from '../../platform/geo';
import { positiveId } from '../../platform/entity-data';
import { entityId } from '../../platform/transit-model';
import type { TransitCity } from '../../platform/transit-model';

export interface StudioStop { id: string; coordinate: Coordinate; name: string }
export interface StudioDraft { cityId: string; nameAr: string; nameEn: string; price: string; notes: string; colorIndex: number; segments: Coordinate[][]; stops: StudioStop[]; editingDraftId: number | null; editingRouteId: string | null }
export type GeometrySnapshot = Pick<StudioDraft, 'segments' | 'stops'>;
export function restoreGeometry(current: StudioDraft, snapshot: GeometrySnapshot): StudioDraft { return { ...current, segments: snapshot.segments, stops: snapshot.stops }; }
type Tuple = [number, number];
type Feature = { type: 'Feature'; properties: { colorIndex: number } | { nameAr: string }; geometry: { type: 'LineString' | 'MultiLineString' | 'Point'; coordinates: Tuple | Tuple[] | Tuple[][] } };
export function emptyDraft(cityId = ''): StudioDraft { return { cityId, nameAr: '', nameEn: '', price: '', notes: '', colorIndex: 0, segments: [], stops: [], editingDraftId: null, editingRouteId: null }; }
export function studioCities(cities: readonly TransitCity[], permissions: readonly string[], scope: readonly string[] | null): TransitCity[] {
  const restricted = permissions.some(permission => permission.startsWith('transit.')) && scope !== null;
  return cities.filter(city => city.status === 'active' && (!restricted || scope.includes(String(city.id))));
}
const tuple = (coordinate: Coordinate): Tuple => [coordinate.longitude, coordinate.latitude];
function point(value: unknown, unwrap = false): Coordinate {
  let pair = array(value);
  if (unwrap && pair.length === 1 && Array.isArray(pair[0])) pair = pair[0];
  if (pair.length !== 2) throw new Error('إحداثيات المسار غير صالحة.');
  return decodeCoordinate(pair[1], pair[0]);
}
export function decodeStudioDraft(value: unknown): StudioDraft {
  const row = record(value), source = typeof row.geojson === 'string' ? JSON.parse(row.geojson) as unknown : row.geojson, collection = record(source);
  const features = collection.type === 'Feature' ? [collection] : collection.type === 'FeatureCollection' ? array(collection.features) : (() => { throw new Error('بيانات رسم المسار غير صالحة.'); })();
  const segments: Coordinate[][] = [], stops: StudioStop[] = [];
  let colorIndex: unknown = row.color_index ?? row.colorIndex ?? 0;
  for (const item of features) {
    const feature = record(item), geometry = record(feature.geometry), properties = feature.properties == null ? {} : record(feature.properties);
    if (feature.type !== 'Feature') throw new Error('عنصر رسم المسار غير صالح.');
    if (properties.colorIndex !== undefined || properties.color_index !== undefined) colorIndex = properties.colorIndex ?? properties.color_index;
    if (geometry.type === 'LineString') segments.push(array(geometry.coordinates).map(coordinate => point(coordinate)));
    else if (geometry.type === 'MultiLineString') segments.push(...array(geometry.coordinates).map(line => array(line).map(coordinate => point(coordinate))));
    else if (geometry.type === 'Point') stops.push({ id: `loaded-${stops.length}`, coordinate: point(geometry.coordinates, true), name: text(properties.nameAr, '') });
    else throw new Error('نوع رسم المسار غير مدعوم.');
  }
  const color = typeof colorIndex === 'string' && colorIndex.trim() ? Number(colorIndex) : colorIndex;
  const index = integer(color);
  if (index < 0) throw new Error('لون المسار غير صالح.');
  const published = row.is_published_route === true;
  const price = row.price == null ? '' : String(finiteNumber(row.price));
  return { ...emptyDraft(row.city_id == null ? '' : String(entityId(row.city_id))), nameAr: text(row.name_ar), nameEn: text(row.name_en, ''), price, notes: text(row.notes, ''), colorIndex: index, segments, stops,
    editingDraftId: published ? null : positiveId(row.id), editingRouteId: row.route_id == null ? null : String(entityId(row.route_id)) };
}
export function decodeLocalDraft(value: unknown): StudioDraft {
  const row = record(value), colorIndex = integer(row.colorIndex);
  if (colorIndex < 0) throw new Error('لون المسودة غير صالح.');
  return { cityId: text(row.cityId), nameAr: text(row.nameAr), nameEn: text(row.nameEn), price: text(row.price), notes: text(row.notes), colorIndex,
    segments: array(row.segments).map(line => array(line).map(item => { const coordinate = record(item); return decodeCoordinate(coordinate.latitude, coordinate.longitude); })),
    stops: array(row.stops).map(item => { const stop = record(item), coordinate = record(stop.coordinate); return { id: text(stop.id), name: text(stop.name), coordinate: decodeCoordinate(coordinate.latitude, coordinate.longitude) }; }),
    editingDraftId: row.editingDraftId == null ? null : positiveId(row.editingDraftId), editingRouteId: row.editingRouteId == null ? null : String(entityId(row.editingRouteId)) };
}
export function buildPayload(draft: StudioDraft): { city_id: string; name_ar: string; name_en: string | null; price: number | null; notes: string | null; color_index: number; route_id: string | null; geojson: { type: 'FeatureCollection'; features: Feature[] } } {
  entityId(draft.cityId);
  const name = draft.nameAr.trim(), english = draft.nameEn.trim(), price = draft.price.trim();
  if (!name || [...name].length > 255 || [...english].length > 255) throw new Error('أدخل اسم المسار بالعربية، حتى 255 حرفاً.');
  if (price && (!/^\d+$/.test(price) || !Number.isSafeInteger(Number(price)))) throw new Error('التعرفة يجب أن تكون عدداً صحيحاً غير سالب.');
  if (!Number.isInteger(draft.colorIndex) || draft.colorIndex < 0 || draft.colorIndex > facts.color_index_max) throw new Error('اختر لوناً صالحاً للمسار.');
  if (!draft.segments.length || draft.segments.some(segment => segment.length < 2)) throw new Error('يجب رسم مسار بنقطتين على الأقل لكل جزء.');
  if (draft.stops.length + 1 > 500) throw new Error('الحد الأقصى 499 موقفاً لكل مسار.');
  const segments = draft.segments.map(segment => segment.map(coordinate => tuple(decodeCoordinate(coordinate.latitude, coordinate.longitude))));
  const features: Feature[] = [{ type: 'Feature', properties: { colorIndex: draft.colorIndex }, geometry: { type: segments.length > 1 ? 'MultiLineString' : 'LineString', coordinates: segments.length > 1 ? segments : segments[0]! } },
    ...draft.stops.map(stop => ({ type: 'Feature' as const, properties: { nameAr: stop.name }, geometry: { type: 'Point' as const, coordinates: tuple(decodeCoordinate(stop.coordinate.latitude, stop.coordinate.longitude)) } }))];
  return { city_id: draft.cityId, name_ar: name, name_en: english || null, price: price ? Number(price) : null, notes: draft.notes.trim() || null, color_index: draft.colorIndex, route_id: draft.editingRouteId, geojson: { type: 'FeatureCollection', features } };
}
const mercator = (latitude: number): number => Math.log(Math.tan(Math.PI / 4 + Math.max(-85, Math.min(85, latitude)) * Math.PI / 360));
export function nearestOnRoute(segments: readonly Coordinate[][], coordinate: Coordinate): { coordinate: Coordinate; segment: number; insertIndex: number } {
  let best = { coordinate, segment: 0, insertIndex: 0 }, distance = Infinity;
  for (let segment = 0; segment < segments.length; segment++) for (let index = 0; index < (segments[segment]?.length ?? 0) - 1; index++) {
    const a = segments[segment]![index]!, b = segments[segment]![index + 1]!, dx = b.longitude - a.longitude, dy = b.latitude - a.latitude, length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((coordinate.longitude - a.longitude) * dx + (coordinate.latitude - a.latitude) * dy) / length));
    const candidate = { longitude: a.longitude + t * dx, latitude: a.latitude + t * dy };
    const projected = Math.hypot((candidate.longitude - coordinate.longitude) * Math.PI / 180, mercator(candidate.latitude) - mercator(coordinate.latitude));
    if (projected < distance) { distance = projected; best = { coordinate: candidate, segment, insertIndex: index + 1 }; }
  }
  return best;
}
export function withSegments(draft: StudioDraft, segments: Coordinate[][]): StudioDraft { return { ...draft, segments, stops: segments.some(line => line.length > 1) ? draft.stops.map(stop => ({ ...stop, coordinate: nearestOnRoute(segments, stop.coordinate).coordinate })) : draft.stops }; }
export function replaceVertex(draft: StudioDraft, segment: number, vertex: number, coordinate: Coordinate): StudioDraft {
  if (!draft.segments[segment]?.[vertex]) throw new Error('نقطة المسار غير موجودة.');
  return withSegments(draft, draft.segments.map((line, index) => index === segment ? line.map((item, position) => position === vertex ? coordinate : item) : line));
}
export function overlapsRoute(drawn: readonly Coordinate[][], routes: readonly Coordinate[][]): boolean {
  const points = drawn.flat(); if (!points.length) return false;
  const bounds = (line: readonly Coordinate[]) => [Math.min(...line.map(item => item.longitude)), Math.min(...line.map(item => item.latitude)), Math.max(...line.map(item => item.longitude)), Math.max(...line.map(item => item.latitude))] as const;
  const [west, south, east, north] = bounds(points), area = (east - west) * (north - south);
  if (!area) return false;
  return routes.some(line => { if (!line.length) return false; const [x1, y1, x2, y2] = bounds(line), width = Math.min(east, x2) - Math.max(west, x1), height = Math.min(north, y2) - Math.max(south, y1); return width > 0 && height > 0 && width * height / area > 0.6; });
}
// PORT STATUS: source resources/js/Pages/Transit/studio/Index.tsx and _store/useStudioStore.ts; confidence medium; todos 1 native geometry and persistence characterization.
