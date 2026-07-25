export type PlaceCategory = 'historical' | 'natural' | 'cultural' | 'religious' | 'abandoned' | 'viewpoint' | 'market' | 'food' | 'other';
export type PlaceStatus = 'pending' | 'approved' | 'rejected';

export interface LatLng { lat: number; lng: number; }

export interface PlaceUser { id: number; name: string; avatar_url: string | null; level: number; points: number; }

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

export interface PlaceFeatureProps { id: number; name: string; category: PlaceCategory; user_id: number; thumb_url: string | null; }

export interface PlaceFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  properties: PlaceFeatureProps;
}

export interface PlaceFeatureCollection { type: 'FeatureCollection'; features: PlaceFeature[]; }

export interface Paginated<T> { data: T[]; current_page: number; last_page: number; total: number; }

export type GuidesSort = 'submissions' | 'saves' | 'recent';

export interface Guide {
  rank: number; user_id: number; name: string; avatar_url: string | null;
  approved_count: number; saves_total: number; recent_count: number;
  points: number; level: number;
}

export interface GridPhoto {
  id: number; thumb_url: string; display_url: string;
  place: { id: number; name: string; category: string; lat: number; lng: number };
}

export interface GeoSuggestion { name: string; address: string; lat: number; lng: number; }

// Hotels (HalaSyria)
export interface HotelListItem {
  id: number; name: string; name_ar: string | null; city: string; city_ar: string | null;
  slug: string; lat: number; lng: number; star_rating: number | null;
  now_show_rate: number | null; currency: string; thumb_url: string | null; source_url: string;
}

export interface HotelDetail extends HotelListItem {
  city_slug: string; rating: number | null; review_count: number;
  address: string | null; address_ar: string | null;
  phone: string | null; email: string | null;
  description: string | null; description_ar: string | null;
  images: string[] | null;
  has_restaurant: boolean; has_swimming_pool: boolean; has_spa: boolean;
  has_fitness_center: boolean; has_parking: boolean; has_airport_shuttle: boolean;
  has_bar: boolean; has_room_service: boolean;
}

export interface HotelFeatureProps {
  id: number; name: string; name_ar: string | null; type: 'hotel';
  star_rating: number | null; now_show_rate: number | null;
  city: string; city_ar: string | null; thumb_url: string | null; slug: string;
}

export interface HotelFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: HotelFeatureProps;
}

export interface HotelFeatureCollection { type: 'FeatureCollection'; features: HotelFeature[]; }
