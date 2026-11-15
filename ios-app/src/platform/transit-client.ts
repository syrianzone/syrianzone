import { api, type ApiClient } from '../api';
import { isCoordinate, parseTransitMap, type Coordinate, type EntityId } from '../domain';
import facts from '../../../resources/data/transit.json';
import { decodeCities, decodeNearby, decodePois, decodeRouteMetadata, decodeTransitSearch, entityId, type NetworkRoute, type TransitNetwork } from './transit-model';

const key = (id: EntityId): string => encodeURIComponent(String(entityId(id)));
export function createTransitClient(client: Pick<ApiClient, 'request'> = api) {
  return {
    cities: (signal: AbortSignal) => client.request('transit/cities', decodeCities, { signal }),
    async network(cityId: EntityId, signal: AbortSignal): Promise<TransitNetwork> {
      const [map, metadata] = await Promise.all([client.request(`transit/cities/${key(cityId)}/map-data`, parseTransitMap, { signal }), client.request(`transit/cities/${key(cityId)}/routes`, decodeRouteMetadata, { signal })]);
      const meta = new Map(metadata.map(route => [String(route.id), route]));
      const routes: NetworkRoute[] = map.routes.map(route => { const row = meta.get(String(route.id)); return { ...route, cityId: row?.cityId ?? null, nameEn: row?.nameEn ?? null, stopsCount: row?.stopsCount ?? route.stopIds.length }; });
      const drawn = new Set(routes.map(route => String(route.id)));
      for (const route of metadata) if (!drawn.has(String(route.id))) routes.push({ ...route, segments: [], stopIds: [] });
      return { routes, stops: map.stops };
    },
    search: (query: string, cityId: EntityId, signal: AbortSignal) => client.request('transit/search', decodeTransitSearch, { signal, params: { q: query.trim().slice(0, 100), city_id: String(entityId(cityId)) } }),
    pois: (query: string, cityId: EntityId, signal: AbortSignal) => client.request('/api/v1/geo/poi', decodePois, { signal, params: { q: query.trim().slice(0, 100), city_id: String(entityId(cityId)) } }),
    nearby(coordinate: Coordinate, signal: AbortSignal) { if (!isCoordinate(coordinate)) throw new Error('الإحداثيات غير صالحة.'); return client.request('transit/stops/nearby', decodeNearby, { signal, params: { lat: coordinate.latitude, lng: coordinate.longitude, radius: facts.nearby_stops_radius_m } }); },
  };
}
export const transitClient = createTransitClient();
// PORT STATUS: source resources/js/Pages/Transit/_lib/api.ts; confidence medium; todos 1 public endpoint decoder verification.
