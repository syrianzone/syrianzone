import axios from '@/Lib/axios';
import type {
  AdminPlace,
  MyPlace,
  NearbyPlace,
  Paginated,
  PlaceCategory,
  PlaceComment,
  PlaceDetail,
  PlaceFeatureCollection,
  PlaceListItem,
  PlaceReport,
} from './types';

const base = '/api/v1';

export const api = {
  async mapData(): Promise<PlaceFeatureCollection> {
    const { data } = await axios.get(`${base}/places/map`);
    return data;
  },

  async listPlaces(params: { category?: PlaceCategory; q?: string; sort?: 'newest' | 'popular'; page?: number }): Promise<Paginated<PlaceListItem>> {
    const { data } = await axios.get(`${base}/places`, { params });
    return data;
  },

  async nearby(params: { lat: number; lng: number; radius_km?: number; include_pending?: boolean }): Promise<{ places: NearbyPlace[] }> {
    const { data } = await axios.get(`${base}/places/nearby`, { params });
    return data;
  },

  async getPlace(id: number): Promise<PlaceDetail> {
    const { data } = await axios.get(`${base}/places/${id}`);
    return data;
  },

  async submitPlace(data: { name: string; category: PlaceCategory; description: string; lat: number; lng: number; photos: File[] }): Promise<{ id: number; status: 'pending' }> {
    const form = new FormData();
    form.append('name', data.name);
    form.append('category', data.category);
    form.append('description', data.description);
    form.append('lat', String(data.lat));
    form.append('lng', String(data.lng));
    data.photos.forEach((photo) => form.append('photos[]', photo));
    const { data: res } = await axios.post(`${base}/places`, form);
    return res;
  },

  async myPlaces(page?: number): Promise<Paginated<MyPlace>> {
    const { data } = await axios.get(`${base}/my/places`, { params: { page } });
    return data;
  },

  async mySaves(page?: number): Promise<Paginated<PlaceListItem>> {
    const { data } = await axios.get(`${base}/my/saves`, { params: { page } });
    return data;
  },

  async like(id: number): Promise<{ liked: boolean; likes_count: number }> {
    const { data } = await axios.post(`${base}/places/${id}/like`);
    return data;
  },

  async unlike(id: number): Promise<{ liked: boolean; likes_count: number }> {
    const { data } = await axios.delete(`${base}/places/${id}/like`);
    return data;
  },

  async save(id: number): Promise<{ saved: boolean; saves_count: number }> {
    const { data } = await axios.post(`${base}/places/${id}/save`);
    return data;
  },

  async unsave(id: number): Promise<{ saved: boolean; saves_count: number }> {
    const { data } = await axios.delete(`${base}/places/${id}/save`);
    return data;
  },

  async listComments(placeId: number, page?: number): Promise<Paginated<PlaceComment>> {
    const { data } = await axios.get(`${base}/places/${placeId}/comments`, { params: { page } });
    return data;
  },

  async addComment(placeId: number, body: string): Promise<PlaceComment> {
    const { data } = await axios.post(`${base}/places/${placeId}/comments`, { body });
    return data;
  },

  async deleteComment(commentId: number): Promise<void> {
    await axios.delete(`${base}/place-comments/${commentId}`);
  },

  async report(placeId: number, reason: string, details?: string): Promise<{ message: string }> {
    const { data } = await axios.post(`${base}/places/${placeId}/report`, { reason, details });
    return data;
  },

  async adminListPlaces(status: 'pending' | 'approved' | 'rejected' | 'all', page?: number): Promise<Paginated<AdminPlace>> {
    const { data } = await axios.get(`${base}/admin/places`, { params: { status, page } });
    return data;
  },

  async adminApprove(id: number): Promise<{ id: number; status: string }> {
    const { data } = await axios.post(`${base}/admin/places/${id}/approve`);
    return data;
  },

  async adminReject(id: number, reason: string | null): Promise<{ id: number; status: string }> {
    const { data } = await axios.post(`${base}/admin/places/${id}/reject`, { reason });
    return data;
  },

  async adminDeletePlace(id: number): Promise<void> {
    await axios.delete(`${base}/admin/places/${id}`);
  },

  async adminListReports(status: 'open' | 'resolved' | 'dismissed' | 'all', page?: number): Promise<Paginated<PlaceReport>> {
    const { data } = await axios.get(`${base}/admin/place-reports`, { params: { status, page } });
    return data;
  },

  async adminResolveReport(id: number, action: 'resolve' | 'dismiss'): Promise<{ id: number; status: string }> {
    const { data } = await axios.post(`${base}/admin/place-reports/${id}/resolve`, { action });
    return data;
  },
};

const STATUS_MESSAGES: Record<number, string> = {
  400: 'تعذر تنفيذ الطلب',
  401: 'سجل الدخول للمتابعة',
  403: 'غير مسموح لك بهذا الإجراء',
  404: 'العنصر غير موجود',
  419: 'انتهت الجلسة، أعد تحميل الصفحة',
  422: 'تحقق من البيانات المدخلة',
  429: 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
};

export function extractError(e: unknown): string {
  const err = e as { response?: { status?: number; data?: { message?: string; error?: string } } };
  const message = err.response?.data?.message ?? err.response?.data?.error;
  // only trust the app's own Arabic messages; Laravel defaults are English
  if (message && /[\u0600-\u06FF]/.test(message)) return message;
  const status = err.response?.status;
  return (status !== undefined && STATUS_MESSAGES[status]) || 'حدث خطأ، حاول مجدداً';
}
