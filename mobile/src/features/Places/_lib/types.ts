export type PlaceCategory = 'historical' | 'natural' | 'cultural' | 'religious' | 'abandoned' | 'viewpoint' | 'market' | 'food' | 'other';
export type PlaceStatus = 'pending' | 'approved' | 'rejected';

export interface LatLng { lat: number; lng: number; }

export interface PlaceContributor { id: number; name: string; avatar_url: string | null; }
export interface PlaceUser extends PlaceContributor { level: number; points: number; }

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

export interface AdminPlace extends Omit<PlaceDetail, 'user'> {
  rejection_reason: string | null;
  user: PlaceContributor;
}

export interface PlaceFeatureProps { id: number; name: string; category: PlaceCategory; user_id: number; thumb_url: string | null; }

export interface PlaceFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: PlaceFeatureProps;
}

export interface PlaceFeatureCollection { type: 'FeatureCollection'; features: PlaceFeature[]; }

export interface Paginated<T> { data: T[]; current_page: number; last_page: number; total: number; }

export interface GuideFilter { id: number; name: string; }

export type GuidesSort = 'points' | 'submissions' | 'saves' | 'recent';

export interface Guide {
  rank: number; user_id: number; name: string; avatar_url: string | null;
  approved_count: number; saves_total: number; recent_count: number;
  points: number; level: number;
}

export interface GridPhoto {
  id: number; thumb_url: string; display_url: string;
  place: { id: number; name: string; category: PlaceCategory; lat: number; lng: number };
}

export interface GeoSuggestion { name: string; address: string; lat: number; lng: number; }

/*
PORT STATUS
  source:     resources/js/Pages/Places/_lib/types.ts (52 lines)
  confidence: high
  todos:      0
  notes:      Native contracts preserve guide points and levels, contributor identity, discovery, photos, moderation, and GeoJSON fields.
*/
