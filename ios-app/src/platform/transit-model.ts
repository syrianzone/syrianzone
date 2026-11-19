import { isEntityId, parseCities, type City, type Coordinate, type EntityId, type TransitMap, type TransitRoute, type TransitStop } from '../domain';
import { array, finiteNumber, integer, record, text } from './validation';
import { decodeCoordinate } from './geo';
import { nonnegative } from './entity-data';

export interface TransitCity extends City { status: 'active' | 'coming_soon'; zoom: number; bounds: [Coordinate, Coordinate] | null; mapGroup: string[]; mapGroupLabel: string | null; icon: { viewBox: string; path: string } | null }
export interface RouteMetadata { id: EntityId; cityId: string | null; name: string; nameEn: string | null; colorIndex: number | null; priceOld: number | null; priceNew: number | null; stopsCount: number | null }
export interface NetworkRoute extends TransitRoute { cityId: string | null; nameEn: string | null; stopsCount: number | null }
export interface TransitNetwork extends TransitMap { routes: NetworkRoute[] }
export interface NearbyStop extends TransitStop { cityId: string; routes: { id: EntityId; name: string }[] }
export interface SearchEntry { id: EntityId; name: string; nameEn: string | null; cityId: string; coordinate: Coordinate | null }
export interface SearchGroups { routes: SearchEntry[]; stops: SearchEntry[] }
export interface Poi { name: string; subtitle: string; coordinate: Coordinate }
export function entityId(value: unknown): EntityId { if (!isEntityId(value)) throw new Error('معرّف النقل غير صالح.'); return value; }
const optionalText = (value: unknown): string | null => value == null ? null : text(value);
const optionalNumber = (value: unknown): number | null => value == null ? null : finiteNumber(value);
function tuple(value: unknown): Coordinate { const row = array(value); if (row.length !== 2) throw new Error('إحداثيات النقل غير صالحة.'); return decodeCoordinate(row[1], row[0]); }
export function decodeCities(value: unknown): TransitCity[] {
  const rows = array(value), bases = parseCities(rows);
  return rows.map((item, index) => {
    const row = record(item), base = bases[index]!;
    if (row.status !== 'active' && row.status !== 'coming_soon') throw new Error('حالة المدينة غير صالحة.');
    const rawBounds = row.bounds == null ? null : array(row.bounds);
    const bounds: [Coordinate, Coordinate] | null = rawBounds?.length === 2 ? [tuple(rawBounds[0]), tuple(rawBounds[1])] : null;
    if (rawBounds && !bounds || bounds && (bounds[0].latitude > bounds[1].latitude || bounds[0].longitude > bounds[1].longitude)) throw new Error('حدود المدينة غير صالحة.');
    const zoom = row.zoom == null ? 12 : finiteNumber(row.zoom);
    if (zoom < 0 || zoom > 24) throw new Error('مقياس خريطة المدينة غير صالح.');
    let icon: TransitCity['icon'] = null;
    if (row.icon != null) {
      const raw = record(row.icon), viewBox = text(raw.viewBox), path = text(raw.path), dimensions = viewBox.trim().split(/[\s,]+/).map(Number);
      if (dimensions.length !== 4 || !dimensions.every(Number.isFinite) || dimensions[2]! <= 0 || dimensions[3]! <= 0 || !path || path.length > 250_000 || !/^[MmLlHhVvCcSsQqTtAaZz\dEe.,+\s-]+$/.test(path)) throw new Error('رسم المحافظة غير صالح.');
      icon = { viewBox, path };
    }
    return { ...base, comingSoon: base.comingSoon || base.routeCount === 0, status: row.status, bounds, zoom, mapGroup: array(row.mapGroup ?? [base.id]).map(id => String(entityId(id))), mapGroupLabel: optionalText(row.mapGroupLabel), icon };
  });
}
export function decodeRouteMetadata(value: unknown): RouteMetadata[] {
  return array(value).map(item => { const row = record(item), color = row.colorIndex == null ? null : integer(row.colorIndex); if (color !== null && color < 0) throw new Error('لون المسار غير صالح.'); return { id: entityId(row.id), cityId: row.cityId == null ? null : String(entityId(row.cityId)), name: text(row.nameAr), nameEn: optionalText(row.nameEn), colorIndex: color, priceOld: optionalNumber(row.priceOld), priceNew: optionalNumber(row.priceNew), stopsCount: row.stopsCount == null ? null : nonnegative(row.stopsCount) }; });
}
export function groupRoutes<T extends RouteMetadata>(city: TransitCity, routes: readonly T[], cities: readonly TransitCity[]): { id: string; name: string; routes: T[] }[] {
  if (city.mapGroup.length <= 1) return [{ id: String(city.id), name: city.nameAr, routes: [...routes] }];
  const groups = city.mapGroup.map(id => ({ id, name: cities.find(item => String(item.id) === id)?.nameAr ?? id, routes: routes.filter(route => route.cityId === id) }));
  const other = routes.filter(route => !city.mapGroup.includes(route.cityId ?? ''));
  if (other.length) groups.push({ id: 'other', name: 'مسارات أخرى', routes: other });
  return groups.filter(group => group.routes.length);
}
export function decodeNearby(value: unknown): NearbyStop[] {
  return array(value).map(item => { const row = record(item), routes = array(row.routes).map(rawRoute => { const route = record(rawRoute); return { id: entityId(route.id), name: text(route.name_ar) }; }); return { id: entityId(row.id), name: text(row.nameAr), cityId: String(entityId(row.cityId)), coordinate: tuple(row.coordinates), routes, routeIds: routes.map(route => route.id) }; });
}
export function routesForStop(stop: TransitStop | NearbyStop, routes: readonly NetworkRoute[], fallbackCity: string): { id: EntityId; name: string; cityId: string }[] {
  if ('routes' in stop) return stop.routes.map(route => ({ ...route, cityId: stop.cityId }));
  return stop.routeIds.map(id => { const route = routes.find(item => String(item.id) === String(id)); return { id, name: route?.name ?? String(id), cityId: route?.cityId ?? fallbackCity }; });
}
export function decodeTransitSearch(value: unknown): SearchGroups {
  const row = record(value);
  const decode = (item: unknown): SearchEntry => { const entry = record(item); return { id: entityId(entry.id), name: text(entry.nameAr), nameEn: optionalText(entry.nameEn), cityId: String(entityId(entry.cityId)), coordinate: entry.coordinates == null ? null : tuple(entry.coordinates) }; };
  return { routes: array(row.routes).map(decode), stops: array(row.stops).map(decode) };
}
export function decodePois(value: unknown): Poi[] {
  return array(record(value).places).map(item => { const row = record(item); return { name: text(row.name), subtitle: [row.category, row.district, row.city, row.address].filter(piece => piece != null).map(piece => text(piece)).filter(Boolean).join(' · '), coordinate: decodeCoordinate(row.lat, row.lng) }; });
}
// PORT STATUS: source resources/js/Domain/transit/types.ts and Pages/Transit/_lib/api.ts; confidence high; todos 0.
