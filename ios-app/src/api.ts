import { isCoordinate, isEntityId, parseCities, parseNearbyStops, parsePlaceDetail, parsePlacePage, parseTransitMap, placeCategories, type City, type EntityId, type Page, type Place, type PlaceDetail, type TransitMap, type TransitStop } from './domain';

export type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;
export interface PlacesQuery { query?: string; category?: string; sort?: 'newest' | 'popular'; page?: number }
export interface ApiClient {
  cities(signal?: AbortSignal): Promise<City[]>;
  transitMap(cityId: EntityId, signal?: AbortSignal): Promise<TransitMap>;
  places(query?: PlacesQuery, signal?: AbortSignal): Promise<Page<Place>>;
  place(placeId: number, signal?: AbortSignal): Promise<PlaceDetail>;
  nearbyStops(location: { latitude: number; longitude: number }, signal?: AbortSignal): Promise<TransitStop[]>;
}

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 0) { super(message); this.name = 'ApiError'; }
}

function cancelled(): ApiError { return new ApiError('cancelled', 'تم إلغاء الطلب.'); }
function invalidInput(): never { throw new ApiError('invalid_input', 'الطلب غير صالح.'); }
function resourceId(value: EntityId): string { return isEntityId(value) ? encodeURIComponent(String(value)) : invalidInput(); }
function httpError(status: number): ApiError {
  const message = status === 404 ? 'لم تعد هذه البيانات متاحة.' : status === 429 ? 'طلبات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.' : 'الخدمة غير متاحة الآن. حاول مرة أخرى.';
  return new ApiError('http', message, status);
}

export function createApiClient({ origin = process.env.EXPO_PUBLIC_API_ORIGIN ?? 'https://syrian.zone', fetch: transport = globalThis.fetch, timeoutMs = 15_000 }: {
  origin?: string;
  fetch?: FetchImplementation;
  timeoutMs?: number;
} = {}): ApiClient {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash || !Number.isFinite(timeoutMs) || timeoutMs <= 0) invalidInput();

  async function request<T>(path: string, decode: (value: unknown) => T, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw cancelled();
    const controller = new AbortController();
    const forwardAbort = (): void => controller.abort();
    signal?.addEventListener('abort', forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let rejectAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      rejectAbort = () => reject(signal?.aborted ? cancelled() : new ApiError('timeout', 'انتهت مهلة الاتصال. حاول مرة أخرى.', 408));
      controller.signal.addEventListener('abort', rejectAbort, { once: true });
    });
    try {
      const response = await Promise.race([transport(new URL(`/api/v1/${path}`, base).toString(), { headers: { Accept: 'application/json' }, signal: controller.signal }), aborted]);
      if (!response.ok) throw httpError(response.status);
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new ApiError('invalid_response', 'أعاد الخادم بيانات غير صالحة.', 502);
      try { return decode(await Promise.race([response.json(), aborted])); }
      catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('invalid_response', 'أعاد الخادم بيانات غير صالحة.', 502); }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted) throw signal?.aborted ? cancelled() : new ApiError('timeout', 'انتهت مهلة الاتصال. حاول مرة أخرى.', 408);
      throw new ApiError('network', 'تعذر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forwardAbort);
      if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
    }
  }

  return {
    cities: (signal) => request('transit/cities', parseCities, signal),
    async transitMap(cityId, signal) { return request(`transit/cities/${resourceId(cityId)}/map-data`, parseTransitMap, signal); },
    async places(query = {}, signal) {
      const params = new URLSearchParams();
      if (query.query?.trim()) params.set('q', query.query.trim().slice(0, 100));
      if (query.category) {
        if (!placeCategories.some((item) => item.key === query.category)) invalidInput();
        params.set('category', query.category);
      }
      if (query.sort) params.set('sort', query.sort);
      if (query.page !== undefined) {
        if (!Number.isSafeInteger(query.page) || query.page < 1) invalidInput();
        params.set('page', String(query.page));
      }
      return request(`places?${params}`, parsePlacePage, signal);
    },
    async place(placeId, signal) {
      if (!Number.isSafeInteger(placeId) || placeId < 1) invalidInput();
      return request(`places/${placeId}`, parsePlaceDetail, signal);
    },
    async nearbyStops(location, signal) {
      if (!isCoordinate(location)) invalidInput();
      const params = new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude) });
      return request(`transit/stops/nearby?${params}`, parseNearbyStops, signal);
    },
  };
}

export const api = createApiClient();
