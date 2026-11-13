import { api as client, API_V1 } from '@/Lib/api'
import type { FeatureCollection, RouteProperties, StopProperties } from '../_types'
import type { ActivityLog, Draft, PublishedRoute, RouteStop, StudioDraftPayload } from '../_types/admin'

/** One search row: a route or a stop from our own tables. */
export interface TransitSearchResult {
  type: 'route' | 'stop'
  id: string
  nameAr: string
  nameEn?: string
  cityId: string
  coordinates?: [number, number]
}

/** A geocoder POI, as the search box draws it. */
export interface GeocoderPoi {
  name: string
  category?: string | null
  district?: string | null
  city?: string | null
  address?: string | null
  lat: number
  lng: number
}

export interface NearbyStop {
  id: string
  nameAr: string
  cityId: string
  coordinates: [number, number]
  routes: Array<{ id: string; name_ar: string }>
}

export interface MapDataResponse {
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
}

export interface ImportCandidate {
  name_ar: string
  name_en: string | null
  price: number | null
  notes: string | null
  geojson: unknown
  vertex_count: number
  stop_count: number
  bounds: [number, number, number, number] | null
  warnings: string[]
  source: { doc_name: string; doc_description: string | null }
  suggested_city_id: string | null
}

export interface ImportPreview {
  routes: ImportCandidate[]
  mid: string | null
}

export interface ImportPublishPayload {
  city_id: string
  name_ar: string
  name_en: string | null
  price: number | null
  color_index: number
  notes: string | null
  geojson: unknown
  mode: 'draft' | 'direct'
  source_mid: string | null
}

export interface RouteUpdatePayload {
  name_ar?: string
  name_en?: string | null
  color_index?: number
  price_new?: number | null
}

/** One typed client for the transit resources the map, admin, studio and dashboard read. */
export const transitApi = {
  mapData(cityId: string, signal?: AbortSignal): Promise<MapDataResponse> {
    return client.get(`${API_V1}/cities/${cityId}/map-data`, { signal })
  },

  routes(cityId: string, signal?: AbortSignal): Promise<RouteProperties[]> {
    return client.get(`${API_V1}/cities/${cityId}/routes`, { signal })
  },

  nearbyStops(lat: number, lng: number, radius: number, signal?: AbortSignal): Promise<NearbyStop[]> {
    return client.get(`${API_V1}/stops/nearby`, { params: { lat, lng, radius }, signal })
  },

  search(q: string, cityId: string, signal?: AbortSignal): Promise<{ routes: TransitSearchResult[]; stops: TransitSearchResult[] }> {
    return client.get(`${API_V1}/search`, { params: { q, city_id: cityId }, signal })
  },

  geocoderPois(q: string, cityId: string, signal?: AbortSignal): Promise<{ places: GeocoderPoi[] }> {
    return client.get(`${API_V1}/geo/poi`, { params: { q, city_id: cityId }, signal })
  },

  routeDrafts(): Promise<Draft[]> {
    return client.get(`${API_V1}/admin/route-drafts`)
  },

  adminRoutes(): Promise<PublishedRoute[]> {
    return client.get(`${API_V1}/admin/routes`)
  },

  adminRouteLogs(): Promise<ActivityLog[]> {
    return client.get(`${API_V1}/admin/routes/logs`)
  },

  routeGeoJson(routeId: string): Promise<unknown> {
    return client.get(`${API_V1}/admin/routes/${routeId}/geojson`)
  },

  routeStops(routeId: string): Promise<RouteStop[]> {
    return client.get(`${API_V1}/admin/routes/${routeId}/stops`)
  },

  updateRouteStatus(routeId: string, status: string): Promise<unknown> {
    return client.post(`${API_V1}/admin/routes/${routeId}/status`, { status })
  },

  moveRoute(routeId: string, cityId: string): Promise<unknown> {
    return client.post(`${API_V1}/admin/routes/${routeId}/move`, { city_id: cityId })
  },

  combineRoutes(payload: { route_a_id: string; route_b_id: string; name_ar: string; name_en: string | null; price: number | null }): Promise<unknown> {
    return client.post(`${API_V1}/admin/routes/combine`, payload)
  },

  splitRoute(payload: { route_id: string; split_stop_id: string; name_a_ar: string; name_a_en: string | null; name_b_ar: string; name_b_en: string | null }): Promise<unknown> {
    return client.post(`${API_V1}/admin/routes/split`, payload)
  },

  updateRoute(routeId: string, payload: RouteUpdatePayload): Promise<unknown> {
    return client.put(`${API_V1}/admin/routes/${routeId}`, payload)
  },

  deleteRoute(routeId: string): Promise<unknown> {
    return client.delete(`${API_V1}/admin/routes/${routeId}`)
  },

  importPreview(body: FormData | { url: string; city_id?: string }): Promise<ImportPreview> {
    return client.post(`${API_V1}/admin/routes/import-preview`, body)
  },

  importPublish(payload: ImportPublishPayload): Promise<{ draft_id?: number; route?: { id: string; city_id: string } }> {
    return client.post(`${API_V1}/admin/routes/import-publish`, payload)
  },

  studioRoute(id: string): Promise<StudioDraftPayload> {
    return client.get(`${API_V1}/studio/routes/${id}`)
  },

  studioRouteFromRoute(id: string): Promise<StudioDraftPayload> {
    return client.get(`${API_V1}/studio/routes/${id}/from-route`)
  },

  saveStudioRoute(id: number | null, payload: Record<string, unknown>): Promise<{ id?: number }> {
    return id ? client.put(`${API_V1}/studio/routes/${id}`, payload) : client.post(`${API_V1}/studio/routes`, payload)
  },
}
