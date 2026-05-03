export interface RouteProperties {
  id: string
  nameAr: string
  nameEn: string
  type: 'serafee'
  colorIndex: number
  notes: string
  priceOld: number
  priceNew: number
}

export interface StopProperties {
  id: string
  nameAr: string
  nameEn: string
  routeId: string
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

export interface GeoJsonFeature<T> {
  type: 'Feature'
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties: T
}

export interface FeatureCollection<T> {
  type: 'FeatureCollection'
  generated_at?: string
  features: GeoJsonFeature<T>[]
}
