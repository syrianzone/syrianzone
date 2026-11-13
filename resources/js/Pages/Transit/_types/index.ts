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

/**
 * The GeoJSON payloads the transit API sends. The properties are aliases (not
 * interfaces) so the collections are assignable to the `geojson` package types
 * MapLibre's `setData` and the shared map helpers accept.
 */
export type FeatureCollection<P> = GeoJsonFeatureCollection<Geometry, P>
