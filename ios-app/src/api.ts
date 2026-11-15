import { isCoordinate, isEntityId, parseCities, parseNearbyStops, parsePlaceDetail, parsePlacePage, parseTransitMap, placeCategories, type City, type EntityId, type Page, type Place, type PlaceDetail, type TransitMap, type TransitStop } from './domain';
import { parsePageBootstrap, parsePageResponse, resolveSitePath, waitForSignal, type QueryParameters } from './platform/page-protocol';
import { acceptsExternalResponse, externalReadUrl } from './platform/external-protocol';
import { parseRealtimeConfig, type RealtimeConfig } from './platform/realtime-config';
import { decodeErrorEnvelope } from './platform/error-envelope';
import { configuredSiteOrigin } from './platform/site-origin';

export type FetchImplementation = (input: string, init?: RequestInit) => Promise<Response>;
export interface PlacesQuery { query?: string; category?: string; sort?: 'newest' | 'popular'; page?: number }
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: QueryParameters; body?: unknown; signal?: AbortSignal; authenticated?: boolean; guestSessionId?: string; sessionGeneration?: number;
}
export interface ApiClient {
  setAccessToken(token: string | null): void;
  getSessionGeneration(): number;
  invalidateSessionRequests(): void;
  request<T>(path: string, decode: (value: unknown) => T, options?: ApiRequestOptions): Promise<T>;
  page<T>(path: string, component: string, decode: (props: unknown) => T, options?: { params?: QueryParameters; signal?: AbortSignal; authenticated?: boolean; sessionGeneration?: number }): Promise<T>;
  externalText(url: string, options?: { signal?: AbortSignal }): Promise<string>;
  externalJson<T>(url: string, decode: (value: unknown) => T, options?: { signal?: AbortSignal }): Promise<T>;
  realtimeConfig(signal?: AbortSignal): Promise<RealtimeConfig>;
  cities(signal?: AbortSignal): Promise<City[]>;
  transitMap(cityId: EntityId, signal?: AbortSignal): Promise<TransitMap>;
  places(query?: PlacesQuery, signal?: AbortSignal): Promise<Page<Place>>;
  place(placeId: number, signal?: AbortSignal): Promise<PlaceDetail>;
  nearbyStops(location: { latitude: number; longitude: number }, signal?: AbortSignal): Promise<TransitStop[]>;
}

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 0, public readonly fields: Readonly<Record<string, readonly string[]>> = {}, public readonly retryAfter: number | null = null) { super(message); this.name = 'ApiError'; }
  get errors(): Readonly<Record<string, readonly string[]>> { return this.fields; }
}

function cancelled(): ApiError { return new ApiError('cancelled', 'تم إلغاء الطلب.'); }
function invalidInput(): never { throw new ApiError('invalid_input', 'الطلب غير صالح.'); }
function resourceId(value: EntityId): string { return isEntityId(value) ? encodeURIComponent(String(value)) : invalidInput(); }
function httpError(status: number): ApiError {
  const message = status === 401 ? 'سجّل الدخول للمتابعة.' : status === 403 ? 'ليست لديك صلاحية لتنفيذ هذا الإجراء.' : status === 422 ? 'تحقق من البيانات المدخلة.' : status === 404 ? 'لم تعد هذه البيانات متاحة.' : status === 429 ? 'طلبات كثيرة. انتظر قليلاً ثم حاول مرة أخرى.' : 'الخدمة غير متاحة الآن. حاول مرة أخرى.';
  return new ApiError('http', message, status);
}

export function createApiClient({ origin = configuredSiteOrigin, fetch: transport = globalThis.fetch, timeoutMs = 15_000 }: {
  origin?: string;
  fetch?: FetchImplementation;
  timeoutMs?: number;
} = {}): ApiClient {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash || !Number.isFinite(timeoutMs) || timeoutMs <= 0) invalidInput();
  let token: string | null = null;
  let sessionGeneration = 0;
  let pageVersion: string | null = null;
  let bootstrapping: Promise<string> | null = null;
  let bootstrapHtml: string | null = null;

  async function perform<T>(path: string, options: ApiRequestOptions, read: (response: Response) => Promise<T>, extraHeaders?: Record<string, string>, external = false): Promise<T> {
    const { signal } = options;
    if (signal?.aborted) throw cancelled();
    if (options.authenticated && !token) throw httpError(401);
    const requestGeneration = options.sessionGeneration ?? sessionGeneration;
    const currentSession = () => !options.authenticated || requestGeneration === sessionGeneration;
    const staleSession = () => new ApiError('stale_session', 'تغيّرت الجلسة. أعد المحاولة.');
    if (!currentSession()) throw staleSession();
    let url: URL;
    try { url = external ? externalReadUrl(path) : resolveSitePath(base, path, options.params); } catch { return invalidInput(); }
    if (external && (options.authenticated || options.body !== undefined || (options.method && options.method !== 'GET'))) invalidInput();
    const headers = new Headers({ Accept: 'application/json', 'User-Agent': 'SyrianZone-iOS/0.1', ...extraHeaders });
    if (options.guestSessionId !== undefined) {
      if (external || options.authenticated || !url.pathname.startsWith('/api/v1/guesswho/') || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.guestSessionId)) invalidInput();
      headers.set('X-Guess-Who-Session-ID', options.guestSessionId);
    }
    if (options.authenticated && token) headers.set('Authorization', `Bearer ${token}`);
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if ((options.method ?? 'GET') === 'GET') invalidInput();
      if (typeof FormData !== 'undefined' && options.body instanceof FormData) body = options.body;
      else { headers.set('Content-Type', 'application/json'); body = JSON.stringify(options.body); }
    }
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
      const response = await Promise.race([transport(url.toString(), { method: options.method ?? 'GET', headers, signal: controller.signal, credentials: 'omit', redirect: external ? 'follow' : 'error', ...(body !== undefined ? { body } : {}) }), aborted]);
      if (!currentSession()) throw staleSession();
      if (!response.ok) {
        let failure = httpError(response.status);
        if (response.status >= 400 && response.status < 500 && response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
          try {
            const raw = await Promise.race([response.text(), aborted]);
            if (raw.length <= 40_000) {
              const decoded = decodeErrorEnvelope(JSON.parse(raw) as unknown, response.headers.get('Retry-After'));
              failure = new ApiError('http', decoded.message ?? failure.message, response.status, decoded.fields, decoded.retryAfter);
            }
          } catch (error) { if (error instanceof ApiError) throw error; }
        }
        throw failure;
      }
      if (external ? !acceptsExternalResponse(url, response.url) : response.redirected || (response.url && new URL(response.url).origin !== base.origin)) throw new ApiError('invalid_response', 'أعاد الخادم بيانات غير صالحة.', 502);
      try { const value = await Promise.race([read(response), aborted]); if (!currentSession()) throw staleSession(); return value; }
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

  function request<T>(path: string, decode: (value: unknown) => T, options: ApiRequestOptions = {}): Promise<T> {
    return perform(path, options, async response => {
      if (response.status === 204) return decode(null);
      if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) throw new ApiError('invalid_response', 'أعاد الخادم بيانات غير صالحة.', 502);
      return decode(await response.json());
    });
  }

  async function externalText(url: string, options: { signal?: AbortSignal } = {}): Promise<string> {
    return perform(url, options, async response => {
      const size = Number(response.headers.get('content-length') ?? 0);
      if (size > 16_000_000) throw new Error('External response is too large');
      const value = await response.text();
      if (value.length > 16_000_000) throw new Error('External response is too large');
      return value;
    }, { Accept: 'application/json, text/csv, text/plain' }, true);
  }

  async function version(refresh = false): Promise<string> {
    if (refresh) pageVersion = null;
    if (pageVersion !== null) return pageVersion;
    bootstrapping ??= perform('/', {}, async response => { const html = await response.text(); const bootstrap = parsePageBootstrap(html); bootstrapHtml = html; return bootstrap.version; }, { Accept: 'text/html' })
      .then(value => { pageVersion = value; return value; }).finally(() => { bootstrapping = null; });
    return bootstrapping;
  }

  return {
    setAccessToken(value) { token = value; sessionGeneration += 1; },
    getSessionGeneration: () => sessionGeneration,
    invalidateSessionRequests() { sessionGeneration += 1; },
    request,
    externalText,
    async realtimeConfig(signal) {
      await waitForSignal(version(), signal);
      try { return parseRealtimeConfig(bootstrapHtml ?? ''); }
      catch { throw new ApiError('invalid_response', 'إعداد الاتصال المباشر غير متاح حالياً.', 502); }
    },
    async externalJson(url, decode, options = {}) {
      const value = await externalText(url, options);
      try { return decode(JSON.parse(value) as unknown); }
      catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('invalid_response', 'أعاد الخادم بيانات غير صالحة.', 502); }
    },
    async page(path, component, decode, options = {}) {
      if (!path.startsWith('/')) invalidInput();
      if (options.signal?.aborted) throw cancelled();
      const pageOptions = options.authenticated ? { ...options, sessionGeneration: options.sessionGeneration ?? sessionGeneration } : options;
      for (let attempt = 0; attempt < 2; attempt++) {
        const currentVersion = await waitForSignal(version(attempt > 0), options.signal);
        try {
          return await perform(path, pageOptions, async response => {
            if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('أعاد الخادم بيانات غير صالحة.');
            return decode(parsePageResponse(await response.json(), component));
          }, { 'X-Inertia': 'true', 'X-Inertia-Version': currentVersion, 'X-Requested-With': 'XMLHttpRequest' });
        } catch (error) { if (!(error instanceof ApiError) || error.status !== 409 || attempt === 1) throw error; }
      }
      throw httpError(409);
    },
    cities: (signal) => request('transit/cities', parseCities, signal ? { signal } : {}),
    async transitMap(cityId, signal) { return request(`transit/cities/${resourceId(cityId)}/map-data`, parseTransitMap, signal ? { signal } : {}); },
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
      return request(`places?${params}`, parsePlacePage, signal ? { signal } : {});
    },
    async place(placeId, signal) {
      if (!Number.isSafeInteger(placeId) || placeId < 1) invalidInput();
      return request(`places/${placeId}`, parsePlaceDetail, signal ? { signal } : {});
    },
    async nearbyStops(location, signal) {
      if (!isCoordinate(location)) invalidInput();
      const params = new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude) });
      return request(`transit/stops/nearby?${params}`, parseNearbyStops, signal ? { signal } : {});
    },
  };
}

export const api = createApiClient();
