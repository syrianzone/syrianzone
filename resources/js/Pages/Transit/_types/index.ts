import type { FeatureCollection as GeoJsonFeatureCollection, Geometry } from 'geojson'

export type RouteProperties = {
  id: string
  nameAr: string
  nameEn: string
  type: 'serafee'
  colorIndex: number
  notes: string
  priceOld: number
  priceNew: number
  stopsCount?: number
}

export type StopProperties = {
  id: string
  nameAr: string
  nameEn?: string
  routeIds: string[]
  type: 'stop'
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
}

/**
 * The GeoJSON payloads the transit API sends. The properties are aliases (not
 * interfaces) so the collections are assignable to the `geojson` package types
 * MapLibre's `setData` and the shared map helpers accept.
 */
export type FeatureCollection<P> = GeoJsonFeatureCollection<Geometry, P>
