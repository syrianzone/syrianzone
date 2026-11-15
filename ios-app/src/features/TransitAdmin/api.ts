import { api, type ApiClient, type ApiRequestOptions } from '../../api';
import { integer, record, text } from '../../platform/validation';
import {
  decodeDrafts,
  decodeGeometry,
  decodeImportPreview,
  decodeLogs,
  decodeRoutes,
  decodeStops,
  entityKey,
  type combinePayload,
  type importPayload,
  type routePayload,
  type RouteStatus,
  type splitPayload
} from './model';

const session = (generation: number, signal?: AbortSignal): ApiRequestOptions => ({
  authenticated: true,
  sessionGeneration: generation,
  ...(signal ? { signal } : {})
});
const key = (id: unknown): string => encodeURIComponent(entityKey(id));
function draftKey(id: number): number {
  if (integer(id) < 1) throw new Error('معرّف المسودة غير صالح.');
  return id;
}
function acknowledge(value: unknown): void {
  if (!text(record(value).message)) throw new Error('لم يؤكد الخادم نجاح الإجراء.');
}
function routeIdentity(value: unknown): { id: string; cityId: string } {
  const row = record(value);
  return { id: entityKey(row.id), cityId: entityKey(row.city_id) };
}
function confirmedRoute(value: unknown, id?: string, cityId?: string): { id: string; cityId: string } {
  acknowledge(value);
  const route = routeIdentity(record(value).route);
  if ((id !== undefined && route.id !== id) || (cityId !== undefined && route.cityId !== cityId))
    throw new Error('لم يؤكد الخادم الخط أو المدينة المتوقعة.');
  return route;
}
export function createTransitAdminClient(client: Pick<ApiClient, 'request'> = api) {
  const write = <T>(
    path: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    body: Record<string, unknown> | FormData | undefined,
    generation: number,
    decode: (value: unknown) => T
  ) => client.request(path, decode, { ...session(generation), method, ...(body ? { body } : {}) });
  return {
    drafts: (generation: number, signal: AbortSignal) => client.request('admin/route-drafts', decodeDrafts, session(generation, signal)),
    routes: (generation: number, signal: AbortSignal) => client.request('admin/routes', decodeRoutes, session(generation, signal)),
    logs: (generation: number, signal: AbortSignal) => client.request('admin/routes/logs', decodeLogs, session(generation, signal)),
    geometry: (id: string, generation: number, signal: AbortSignal) =>
      client.request(`admin/routes/${key(id)}/geojson`, decodeGeometry, session(generation, signal)),
    stops: (id: string, generation: number, signal: AbortSignal) =>
      client.request(`admin/routes/${key(id)}/stops`, decodeStops, session(generation, signal)),
    approve: (id: number, color: number, generation: number) =>
      write(`admin/route-drafts/${draftKey(id)}/approve`, 'POST', { color_index: color }, generation, (value) => {
        acknowledge(value);
        return routeIdentity(record(value).route);
      }),
    reject: (id: number, reason: string | null, generation: number) =>
      write(`admin/route-drafts/${draftKey(id)}/reject`, 'POST', { reason }, generation, acknowledge),
    update: (id: string, payload: ReturnType<typeof routePayload> | { color_index: number }, generation: number) =>
      write(`admin/routes/${key(id)}`, 'PUT', payload, generation, (value) => {
        confirmedRoute(value, id);
      }),
    status: (id: string, status: RouteStatus, generation: number) =>
      write(`admin/routes/${key(id)}/status`, 'PATCH', { status }, generation, acknowledge),
    move: (id: string, cityId: string, generation: number) =>
      write(`admin/routes/${key(id)}/move`, 'POST', { city_id: entityKey(cityId) }, generation, (value) => {
        confirmedRoute(value, id, cityId);
      }),
    remove: async (id: string, generation: number) => write(`admin/routes/${key(id)}`, 'DELETE', undefined, generation, acknowledge),
    combine: (payload: ReturnType<typeof combinePayload>, generation: number) =>
      write('admin/routes/combine', 'POST', payload, generation, (value) => {
        const route = confirmedRoute(value);
        if ([payload.route_a_id, payload.route_b_id].includes(route.id)) throw new Error('لم يؤكد الخادم إنشاء الخط المدموج.');
      }),
    split: (payload: ReturnType<typeof splitPayload>, generation: number) =>
      write('admin/routes/split', 'POST', payload, generation, (value) => {
        acknowledge(value);
        const row = record(value),
          first = routeIdentity(row.route_a),
          second = routeIdentity(row.route_b);
        if (first.id === second.id || first.id === payload.route_id || second.id === payload.route_id || first.cityId !== second.cityId)
          throw new Error('لم يؤكد الخادم إنشاء قسمي الخط.');
      }),
    preview: (body: FormData | { url: string; city_id?: string }, generation: number) =>
      write('admin/routes/import-preview', 'POST', body, generation, decodeImportPreview),
    publish: (payload: ReturnType<typeof importPayload>, generation: number) =>
      write('admin/routes/import-publish', 'POST', payload, generation, (value) => {
        acknowledge(value);
        const row = record(value);
        if (payload.mode === 'direct') return { draftId: null, route: confirmedRoute(value, undefined, payload.city_id) };
        const id = draftKey(integer(row.draft_id));
        return { draftId: id, route: null };
      })
  };
}
export const transitAdminClient = createTransitAdminClient();
// PORT STATUS: source Pages/Transit/_lib/api.ts and Domain/transit/api.ts; confidence medium; todos 1 controlled-account server round-trip.
