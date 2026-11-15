import { expect, test } from 'bun:test';
import type { ApiRequestOptions } from '../../api';
import { createTransitAdminClient } from './api';

test('every native transit administration request binds its originating session and cancellation signal', async () => {
  const calls: { path: string; options: ApiRequestOptions }[] = [],
    controller = new AbortController();
  const client = createTransitAdminClient({
    request: async <T>(path: string, decode: (value: unknown) => T, options: ApiRequestOptions = {}) => {
      calls.push({ path, options });
      return decode([]);
    }
  });
  await client.drafts(8, controller.signal);
  await client.routes(8, controller.signal);
  await client.logs(8, controller.signal);
  expect(calls.map((call) => call.path)).toEqual(['admin/route-drafts', 'admin/routes', 'admin/routes/logs']);
  for (const call of calls) expect(call.options).toEqual({ authenticated: true, sessionGeneration: 8, signal: controller.signal });
});
test('transit moderation acknowledges only an explicit JSON result and never dispatches unsafe identities', async () => {
  const calls: { path: string; options: ApiRequestOptions }[] = [];
  let response: unknown = { message: 'Draft approved', route: { id: 'route-a', city_id: 'damascus' } };
  const client = createTransitAdminClient({
    request: async <T>(path: string, decode: (value: unknown) => T, options: ApiRequestOptions = {}) => {
      calls.push({ path, options });
      return decode(response);
    }
  });
  expect(await client.approve(5, 3, 8)).toEqual({ id: 'route-a', cityId: 'damascus' });
  expect(calls[0]).toEqual({
    path: 'admin/route-drafts/5/approve',
    options: { method: 'POST', body: { color_index: 3 }, authenticated: true, sessionGeneration: 8 }
  });
  response = '<html>login</html>';
  await expect(client.reject(5, 'سبب', 8)).rejects.toThrow();
  await expect(client.remove('../../wrong', 8)).rejects.toThrow();
  expect(calls).toHaveLength(2);
});
test('import draft and direct publication require their distinct confirmation identities', async () => {
  let response: unknown = { message: 'Saved', draft_id: 4 };
  const client = createTransitAdminClient({ request: async <T>(_path: string, decode: (value: unknown) => T) => decode(response) });
  const payload = {
    city_id: 'damascus',
    name_ar: 'خط',
    name_en: null,
    price: null,
    color_index: 0,
    notes: null,
    mode: 'draft' as const,
    source_mid: null,
    geojson: { type: 'FeatureCollection' as const, features: [] }
  };
  expect(await client.publish(payload, 8)).toEqual({ draftId: 4, route: null });
  await expect(client.publish({ ...payload, mode: 'direct' }, 8)).rejects.toThrow();
  response = { message: 'Published', route: { id: 'route-a', city_id: 'damascus' } };
  expect(await client.publish({ ...payload, mode: 'direct' }, 8)).toEqual({ draftId: null, route: { id: 'route-a', cityId: 'damascus' } });
  await expect(client.publish({ ...payload, city_id: 'aleppo', mode: 'direct' }, 8)).rejects.toThrow();
});

test('route changes require the resource identities guaranteed by the controller', async () => {
  let response: unknown = { message: 'ok' };
  const client = createTransitAdminClient({ request: async <T>(_path: string, decode: (value: unknown) => T) => decode(response) });
  const combined = { route_a_id: 'route-a', route_b_id: 'route-b', name_ar: 'دمج', name_en: null, price: null };
  const split = { route_id: 'route-a', split_stop_id: 'stop-b', name_a_ar: 'أ', name_a_en: null, name_b_ar: 'ب', name_b_en: null };
  await expect(client.update('route-a', { color_index: 3 }, 8)).rejects.toThrow();
  await expect(client.move('route-a', 'aleppo', 8)).rejects.toThrow();
  await expect(client.combine(combined, 8)).rejects.toThrow();
  await expect(client.split(split, 8)).rejects.toThrow();
  response = { message: 'ok', route: { id: 'wrong-route', city_id: 'damascus' } };
  await expect(client.update('route-a', { color_index: 3 }, 8)).rejects.toThrow();
  response = { message: 'ok', route: { id: 'route-a', city_id: 'damascus' } };
  await expect(client.move('route-a', 'aleppo', 8)).rejects.toThrow();
  await expect(client.update('route-a', { color_index: 3 }, 8)).resolves.toBeUndefined();
  response = { message: 'ok', route: { id: 'route-a', city_id: 'aleppo' } };
  await expect(client.move('route-a', 'aleppo', 8)).resolves.toBeUndefined();
  response = { message: 'ok', route: { id: 'route-new', city_id: 'damascus' } };
  await expect(client.combine(combined, 8)).resolves.toBeUndefined();
  response = { message: 'ok', route: { id: 'route-a', city_id: 'damascus' } };
  await expect(client.combine(combined, 8)).rejects.toThrow();
  response = { message: 'ok', route_a: { id: 'route-new-a', city_id: 'damascus' }, route_b: { id: 'route-new-a', city_id: 'damascus' } };
  await expect(client.split(split, 8)).rejects.toThrow();
  response = { message: 'ok', route_a: { id: 'route-new-a', city_id: 'damascus' }, route_b: { id: 'route-new-b', city_id: 'damascus' } };
  await expect(client.split(split, 8)).resolves.toBeUndefined();
  response = { message: 'ok', route_a: { id: 'route-new-a', city_id: 'damascus' }, route_b: { id: 'route-new-b', city_id: 'aleppo' } };
  await expect(client.split(split, 8)).rejects.toThrow();
  response = { message: 'Already published' };
  await expect(client.status('route-a', 'published', 8)).resolves.toBeUndefined();
});
