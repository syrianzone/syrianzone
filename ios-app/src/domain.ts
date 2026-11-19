import placesFacts from '../../resources/data/places.json';
import transitFacts from '../../resources/data/transit.json';

export type EntityId = number | string;
export interface Coordinate { latitude: number; longitude: number }
export interface City {
  id: EntityId;
  name: string;
  nameAr: string;
  coordinates: Coordinate | null;
  routeCount: number;
  comingSoon: boolean;
}
export interface TransitRoute {
  id: EntityId;
  name: string;
  colorIndex: number | null;
  segments: Coordinate[][];
  stopIds: EntityId[];
  priceOld: number | null;
  priceNew: number | null;
}
export interface TransitStop {
  id: EntityId;
  name: string;
  coordinate: Coordinate;
  routeIds: EntityId[];
  distance?: number;
}
export interface TransitMap { routes: TransitRoute[]; stops: TransitStop[] }
export interface Place {
  id: number;
  name: string;
  category: string;
  description: string | null;
  coordinate: Coordinate;
  thumbnail: string | null;
  savesCount: number;
}
export interface PlacePhoto { id: number; thumbnail: string | null; url: string }
export interface PlaceDetail extends Place { photos: PlacePhoto[]; contributor: string | null }
export interface Page<T> { items: T[]; currentPage: number; lastPage: number; total: number }

export const placeCategories = placesFacts.categories;

function invalid(): never { throw new Error('أعاد الخادم بيانات غير صالحة.'); }
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : invalid();
}
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : invalid(); }
function text(value: unknown): string { return typeof value === 'string' ? value : invalid(); }
function name(value: unknown): string { const result = text(value).trim(); return result.length > 0 ? result : invalid(); }
function number(value: unknown): number { return typeof value === 'number' && Number.isFinite(value) ? value : invalid(); }
function integer(value: unknown, minimum = 0): number { const result = number(value); return Number.isSafeInteger(result) && result >= minimum ? result : invalid(); }
function optionalPrice(value: unknown): number | null {
  if (value == null) return null;
  const result = number(value);
  return result >= 0 ? result : invalid();
}

export function isEntityId(value: unknown): value is EntityId {
  return typeof value === 'number' ? Number.isSafeInteger(value) && value > 0 : typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}
function id(value: unknown): EntityId { return isEntityId(value) ? value : invalid(); }
function nullableText(value: unknown): string | null { return value == null ? null : text(value); }

export function isCoordinate(value: unknown): value is Coordinate {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const { latitude, longitude } = value as Record<string, unknown>;
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
function coordinate(value: unknown): Coordinate {
  const pair = array(value);
  if (pair.length !== 2) return invalid();
  const result = { longitude: number(pair[0]), latitude: number(pair[1]) };
  return isCoordinate(result) ? result : invalid();
}

export function safeHttpsUrl(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value)) return invalid();
  let url: URL;
  try { url = new URL(value); } catch { return invalid(); }
  return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : invalid();
}

export function parseCities(value: unknown): City[] {
  return array(value).map((item) => {
    const raw = record(item);
    if (raw.status !== 'active' && raw.status !== 'coming_soon') return invalid();
    return { id: id(raw.id), name: name(raw.nameAr), nameAr: name(raw.nameAr), coordinates: raw.center == null ? null : coordinate(raw.center), routeCount: integer(raw.routeCount), comingSoon: raw.status === 'coming_soon' };
  });
}

function collection(value: unknown): Record<string, unknown>[] {
  const raw = record(value);
  if (raw.type !== 'FeatureCollection') return invalid();
  return array(raw.features).map((item) => {
    const feature = record(item);
    return feature.type === 'Feature' ? feature : invalid();
  });
}

function routeSegments(value: unknown): Coordinate[][] {
  const geometry = record(value);
  const segments = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.type === 'MultiLineString' ? array(geometry.coordinates) : invalid();
  return segments.map((segment) => {
    const points = array(segment).map(coordinate);
    return points.length >= 2 ? points : invalid();
  });
}

export function parseTransitMap(value: unknown): TransitMap {
  const raw = record(value);
  const stops = collection(raw.stops).map((feature): TransitStop => {
    const geometry = record(feature.geometry);
    const properties = record(feature.properties);
    if (geometry.type !== 'Point') return invalid();
    return { id: id(properties.id), name: name(properties.nameAr), coordinate: coordinate(geometry.coordinates), routeIds: array(properties.routeIds).map(id) };
  });
  const stopIdsByRoute = new Map<EntityId, EntityId[]>();
  for (const stop of stops) {
    for (const routeId of stop.routeIds) {
      const ids = stopIdsByRoute.get(routeId) ?? [];
      ids.push(stop.id);
      stopIdsByRoute.set(routeId, ids);
    }
  }
  const routes = collection(raw.routes).map((feature): TransitRoute => {
    const properties = record(feature.properties);
    const routeId = id(properties.id);
    return {
      id: routeId, name: name(properties.nameAr), colorIndex: properties.colorIndex == null ? null : integer(properties.colorIndex),
      segments: routeSegments(feature.geometry), stopIds: stopIdsByRoute.get(routeId) ?? [],
      priceOld: optionalPrice(properties.priceOld), priceNew: optionalPrice(properties.priceNew),
    };
  });
  return { routes, stops };
}

export function decodePlace(value: unknown): Place {
  const raw = record(value);
  const category = text(raw.category);
  if (!placeCategories.some((item) => item.key === category)) return invalid();
  return {
    id: integer(raw.id, 1), name: name(raw.name), category, description: nullableText(raw.description),
    coordinate: coordinate([raw.lng, raw.lat]), thumbnail: safeHttpsUrl(raw.thumb_url), savesCount: integer(raw.saves_count),
  };
}

export function parsePlacePage(value: unknown): Page<Place> {
  const raw = record(value);
  const currentPage = integer(raw.current_page, 1);
  const lastPage = integer(raw.last_page, 1);
  return { items: array(raw.data).map(decodePlace), currentPage, lastPage, total: integer(raw.total) };
}

export function parsePlaceDetail(value: unknown): PlaceDetail {
  const raw = record(value);
  return {
    ...decodePlace(raw), contributor: raw.user == null ? null : name(record(raw.user).name),
    photos: array(raw.photos ?? []).map((item): PlacePhoto => {
      const photo = record(item);
      const url = safeHttpsUrl(photo.display_url);
      return { id: integer(photo.id, 1), thumbnail: safeHttpsUrl(photo.thumb_url), url: url ?? invalid() };
    }),
  };
}

export function parseNearbyStops(value: unknown): TransitStop[] {
  return array(value).map((item) => {
    const raw = record(item);
    return { id: id(raw.id), name: name(raw.nameAr), coordinate: coordinate(raw.coordinates), routeIds: array(raw.routes).map((route) => id(record(route).id)) };
  });
}

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase('ar').normalize('NFKD')
    .replace(/[\u0300-\u036f\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/['`\u2019\u2018]/g, '').replace(/[-\u2010-\u2015]/g, ' ').replace(/\s+/g, ' ').trim();
}
export function matchesSearch(value: string, query: string): boolean { return normalizeSearch(value).includes(normalizeSearch(query)); }
export function stopsForRoute(map: TransitMap, routeId: EntityId): TransitStop[] { return map.stops.filter((stop) => stop.routeIds.includes(routeId)); }
export function routeColor(index: number | null): string {
  const position = index !== null && Number.isSafeInteger(index) && index >= 0 ? index % transitFacts.route_palette.length : 0;
  return transitFacts.route_palette[position] ?? transitFacts.route_palette[0] ?? '#e8a838';
}

export const decodeCities = parseCities;
export const decodeTransitMap = parseTransitMap;
export const decodePlaceDetail = parsePlaceDetail;
