export type PlaceCategory = 'historical' | 'natural' | 'cultural' | 'religious' | 'abandoned' | 'viewpoint' | 'market' | 'other';
export type PlaceStatus = 'pending' | 'approved' | 'rejected';

export interface LatLng { lat: number; lng: number; }

export interface PlaceUser { id: number; name: string; avatar_url: string | null; }

export interface PlacePhoto { id: number; thumb_url: string; display_url: string; sort: number; }

export interface PlaceListItem {
  id: number; name: string; category: PlaceCategory; description: string;
  lat: number; lng: number; thumb_url: string | null;
  saves_count: number;
}

export interface NearbyPlace extends PlaceListItem { distance_m: number; }

export interface PlaceDetail extends PlaceListItem {
  status: PlaceStatus; user: PlaceUser; photos: PlacePhoto[];
  saved_by_me: boolean; created_at: string;
}

export interface MyPlace extends PlaceListItem { status: PlaceStatus; rejection_reason: string | null; created_at: string; }

export interface AdminPlace extends PlaceDetail { rejection_reason: string | null; }

export interface PlaceFeatureProps { id: number; name: string; category: PlaceCategory; thumb_url: string | null; }

export interface PlaceFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: PlaceFeatureProps;
}

export interface PlaceFeatureCollection { type: 'FeatureCollection'; features: PlaceFeature[]; }

export interface Paginated<T> { data: T[]; current_page: number; last_page: number; total: number; }
