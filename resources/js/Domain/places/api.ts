import { api as client, API_V1 } from '@/Lib/api';
import type {
  GeoSuggestion,
  AdminPlace,
  AdminPlaceReport,
  GridPhoto,
  Guide,
  GuidesSort,
  HotelDetail,
  HotelFeatureCollection,
  HotelListItem,
  LatLng,
  MyPlace,
  NearbyPlace,
  Paginated,
  PlaceCategory,
  PlaceDetail,
  PlaceFeatureCollection,
  PlaceListItem,
  PlaceReportReason,
  PlaceReportStatus,
} from './types';

const base = `${API_V1}/places`;

export const api = {
  async mapData(): Promise<PlaceFeatureCollection> {
    return client.get(`${base}/map`);
  },

  async listPlaces(params: { category?: PlaceCategory; q?: string; sort?: 'newest' | 'popular'; page?: number; user_id?: number }): Promise<Paginated<PlaceListItem>> {
    return client.get(base, { params });
  },

  async geocode(q: string): Promise<{ suggestions: GeoSuggestion[] }> {
    return client.get(`${base}/geocode`, { params: { q } });
  },

  async nearby(params: { lat: number; lng: number; radius_km?: number; include_pending?: boolean }): Promise<{ places: NearbyPlace[] }> {
    return client.get(`${base}/nearby`, { params });
  },

  async getPlace(id: number): Promise<PlaceDetail> {
    return client.get(`${base}/${id}`);
  },

  async submitPlace(data: { name: string; category: PlaceCategory; description: string; lat: number; lng: number; photos: File[] }): Promise<{ id: number; status: 'pending' }> {
    const form = new FormData();
    form.append('name', data.name);
    form.append('category', data.category);
    form.append('description', data.description);
    form.append('lat', String(data.lat));
    form.append('lng', String(data.lng));
    data.photos.forEach((photo) => form.append('photos[]', photo));
    return client.post(base, form);
  },

  async myPlaces(page?: number): Promise<Paginated<MyPlace>> {
    return client.get(`${API_V1}/my/places`, { params: { page } });
  },

  async updateMyPlaceLocation(id: number, coords: LatLng): Promise<{ id: number; lat: number; lng: number; status: 'pending' }> {
    return client.patch(`${API_V1}/my/places/${id}/location`, coords);
  },

  async updateMyPlace(id: number, data: Partial<{ name: string; category: PlaceCategory; description: string }>): Promise<{ id: number; name: string; category: PlaceCategory; description: string; status: 'pending' }> {
    return client.patch(`${API_V1}/my/places/${id}`, data);
  },

  async addMyPhoto(id: number, file: File): Promise<{ id: number; thumb_url: string; display_url: string; sort: number; place_status: 'pending' }> {
    const form = new FormData();
    form.append('photo', file);
    return client.post(`${API_V1}/my/places/${id}/photos`, form);
  },

  async deleteMyPhoto(photoId: number): Promise<{ id: number; place_status: 'pending' }> {
    return client.delete(`${API_V1}/my/place-photos/${photoId}`);
  },

  async rotateMyPhoto(photoId: number): Promise<{ id: number; thumb_url: string; display_url: string }> {
    return client.post(`${API_V1}/my/place-photos/${photoId}/rotate`);
  },

  async deleteMyPlace(id: number): Promise<void> {
    await client.delete(`${API_V1}/my/places/${id}`);
  },

  async resubmitMyPlace(id: number): Promise<{ id: number; status: 'pending' }> {
    return client.post(`${API_V1}/my/places/${id}/resubmit`);
  },

  async guides(sort: GuidesSort): Promise<{ sort: GuidesSort; guides: Guide[] }> {
    return client.get(`${API_V1}/guides`, { params: { sort } });
  },

  async gridPhotos(page: number): Promise<Paginated<GridPhoto>> {
    return client.get(`${base}/photos`, { params: { page } });
  },

  async mySaves(page?: number): Promise<Paginated<PlaceListItem>> {
    return client.get(`${API_V1}/my/saves`, { params: { page } });
  },

  async save(id: number): Promise<{ saved: boolean; saves_count: number }> {
    return client.post(`${base}/${id}/save`);
  },

  async unsave(id: number): Promise<{ saved: boolean; saves_count: number }> {
    return client.delete(`${base}/${id}/save`);
  },

  async report(id: number, reason: PlaceReportReason, details?: string): Promise<{ message: string }> {
    return client.post(`${base}/${id}/report`, { reason, details });
  },

  async adminListReports(status: PlaceReportStatus | 'all', page?: number): Promise<Paginated<AdminPlaceReport>> {
    return client.get(`${API_V1}/admin/place-reports`, { params: { status, page } });
  },

  async adminResolveReport(id: number, action: 'dismiss' | 'unpublish'): Promise<{ id: number; status: PlaceReportStatus }> {
    return client.post(`${API_V1}/admin/place-reports/${id}/resolve`, { action });
  },

  async adminListPlaces(status: 'pending' | 'approved' | 'rejected' | 'all', page?: number): Promise<Paginated<AdminPlace>> {
    return client.get(`${API_V1}/admin/places`, { params: { status, page } });
  },

  async adminApprove(id: number): Promise<{ id: number; status: string }> {
    return client.post(`${API_V1}/admin/places/${id}/approve`);
  },

  async adminReject(id: number, reason: string | null): Promise<{ id: number; status: string }> {
    return client.post(`${API_V1}/admin/places/${id}/reject`, { reason });
  },

  async adminDeletePlace(id: number): Promise<void> {
    await client.delete(`${API_V1}/admin/places/${id}`);
  },

  async adminUpdatePlace(id: number, data: Partial<Pick<AdminPlace, 'name' | 'category' | 'description' | 'lat' | 'lng'>>): Promise<AdminPlace> {
    return client.patch(`${API_V1}/admin/places/${id}`, data);
  },

  async adminAddPhoto(placeId: number, file: File): Promise<{ id: number; thumb_url: string; display_url: string; sort: number }> {
    const form = new FormData();
    form.append('photo', file);
    return client.post(`${API_V1}/admin/places/${placeId}/photos`, form);
  },

  async adminDeletePhoto(photoId: number): Promise<void> {
    await client.delete(`${API_V1}/admin/place-photos/${photoId}`);
  },

  async adminRotatePhoto(photoId: number): Promise<{ id: number; thumb_url: string; display_url: string }> {
    return client.post(`${API_V1}/admin/place-photos/${photoId}/rotate`);
  },

  async adminReplacePhoto(photoId: number, file: File): Promise<{ id: number; thumb_url: string; display_url: string }> {
    const form = new FormData();
    form.append('photo', file);
    return client.post(`${API_V1}/admin/place-photos/${photoId}/replace`, form);
  },

  // Hotels (HalaSyria)
  async hotelMapData(): Promise<HotelFeatureCollection> {
    return client.get(`${API_V1}/hotels/map`);
  },

  async listHotels(params: { city?: string; q?: string; min_stars?: number; max_price?: number; page?: number }): Promise<Paginated<HotelListItem>> {
    return client.get(`${API_V1}/hotels`, { params });
  },

  async getHotel(id: number): Promise<HotelDetail> {
    return client.get(`${API_V1}/hotels/${id}`);
  },
};
