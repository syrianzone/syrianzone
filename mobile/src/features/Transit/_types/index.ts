import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

export interface RouteProperties {
  colorIndex: number;
  id: string;
  nameAr: string;
  nameEn?: string | null;
  notes?: string | null;
  priceNew?: number | null;
  priceOld?: number | null;
  stopsCount?: number;
  type?: 'serafee';
}

export interface StopProperties {
  id: string;
  nameAr: string;
  nameEn?: string | null;
  routeIds: readonly string[];
  type?: 'stop';
}

export interface City {
  bounds: [[number, number], [number, number]] | null;
  center: [number, number];
  id: string;
  nameAr: string;
  nameEn: string;
  routeCount: number;
  status: 'active' | 'coming_soon';
  zoom: number;
}

export type RouteFeature = Feature<LineString, RouteProperties>;
export type StopFeature = Feature<Point, StopProperties>;
export type RouteCollection = FeatureCollection<LineString, RouteProperties>;
export type StopCollection = FeatureCollection<Point, StopProperties>;

export interface MapDataResponse {
  routes: RouteCollection;
  stops: StopCollection;
}

export interface NearbyStop {
  cityId: string;
  coordinates: [number, number];
  id: string;
  nameAr: string;
  routes: readonly { id: string; name_ar: string }[];
}

export interface TransitSearchResult {
  cityId: string;
  coordinates?: [number, number] | null;
  id: string;
  nameAr: string;
  nameEn?: string | null;
  type: 'route' | 'stop';
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_types/index.ts (45 lines)
  confidence: high
  todos:      0
  notes:      GeoJSON types now use the shared native GeoJSON declarations.
*/
