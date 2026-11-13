import type { FeatureCollection as GeoJsonFeatureCollection, Geometry } from 'geojson'

/**
 * A route on the map: `/cities/{id}/map-data` sends exactly these properties —
 * and so does the studio's own optimistic copy, which is why the colour
 * travels under one key (`colorIndex`) everywhere in the browser.
 *
 * The published-route list (`/cities/{id}/routes`) sends the same fields plus
 * `cityId`: the sidebar needs to say which city of a shared map a line belongs
 * to, the map itself does not.
 */
export type RouteProperties = {
  id: string
  cityId?: string
  nameAr: string
  nameEn: string | null
  colorIndex: number | null
  priceOld: number | null
  priceNew: number | null
  stopsCount?: number
}

export type StopProperties = {
  id: string
  nameAr: string
  routeIds: string[]
}

export interface City {
  id: string
  nameAr: string
  nameEn: string
  status: 'active' | 'coming_soon'
  routeCount: number
  bounds: [[number, number], [number, number]] | null
  center: [number, number]
  zoom: number
  /**
   * The cities drawn on the same map, itself included (Damascus and Rif
   * Dimashq are one network). `GET /api/v1/cities` composes it from
   * `City::mapGroup()`; the client never spells a pair of ids itself.
   */
  mapGroup: string[]
  /** The shared map's Arabic name, e.g. «دمشق الكبرى»; null for a map of one. */
  mapGroupLabel: string | null
  /** The governorate outline, on the API payload only (the page draws its own). */
  icon?: { viewBox: string; path: string } | null
}

/**
 * The GeoJSON payloads the transit API sends. The properties are aliases (not
 * interfaces) so the collections are assignable to the `geojson` package types
 * MapLibre's `setData` and the shared map helpers accept.
 */
export type FeatureCollection<P> = GeoJsonFeatureCollection<Geometry, P>
