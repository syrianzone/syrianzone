import { expect, test } from 'bun:test';
import type { ApiRequestOptions } from '../../api';
import { createUsersAdminClient } from './api';
import { decodeUser } from './model';

const raw = {
  id: 2,
  name: 'محلي',
  email: 'local@example.test',
  role: 'user',
  is_banned: false,
  permissions: [],
  effective_permissions: [],
  permission_scopes: {},
  stored_transit_scope: [],
  transit_scope: null,
  created_at: null,
  deleted_at: null,
  version: 'a'.repeat(64),
  is_self: false,
  actions: { edit: true, delete: true, restore: false, force_delete: false, change_ban: true }
};
test('private user reads bind their origin session cancellation and encoded filters', async () => {
  const calls: { path: string; options: ApiRequestOptions }[] = [],
    signal = new AbortController().signal;
  const client = createUsersAdminClient({
    request: async <T>(path: string, decode: (value: unknown) => T, options: ApiRequestOptions = {}) => {
      calls.push({ path, options });
      return decode({ data: [raw], current_page: 1, last_page: 1, total: 1, per_page: 25 });
    }
  });
  await client.list({ query: 'اسم', sort: 'name', direction: 'asc', trashed: 'with', page: 1, perPage: 25 }, 7, signal);
  expect(calls[0]).toEqual({
    path: 'admin/users',
    options: {
      authenticated: true,
      sessionGeneration: 7,
      signal,
      params: { q: 'اسم', sort: 'name', direction: 'asc', trashed: 'with', page: 1, per_page: 25 }
    }
  });
});
test('user deletion rejects a message-only acknowledgement or an unrelated changed identity', async () => {
  let response: unknown = { success: true },
    requests = 0;
  const client = createUsersAdminClient({
    request: async <T>(_path: string, decode: (value: unknown) => T) => {
      requests++;
      return decode(response);
    }
  });
  const user = decodeUser(raw);
  await expect(client.mutate('delete', user, 7)).rejects.toThrow();
  response = { success: true, ids: [4], actor_deleted: false };
  await expect(client.mutate('delete', user, 7)).rejects.toThrow();
  response = { success: true, ids: [2], actor_deleted: false };
  expect(await client.mutate('delete', user, 7)).toEqual({ actorDeleted: false });
  await expect(client.show(-1, 7, new AbortController().signal)).rejects.toThrow();
  expect(requests).toBe(3);
});
test('source self-selection requires an explicit server acknowledgement before clearing the local session', async () => {
  let response: unknown = { success: true, ids: [2], actor_deleted: false };
  const client = createUsersAdminClient({ request: async <T>(_path: string, decode: (value: unknown) => T) => decode(response) });
  const self = decodeUser({ ...raw, is_self: true });
  await expect(client.bulk('delete', [self], 500, 7)).rejects.toThrow();
  response = { success: true, ids: [2], actor_deleted: true };
  expect(await client.bulk('delete', [self], 500, 7)).toEqual({ actorDeleted: true });
});

test('a failed later bulk batch preserves exactly the unconfirmed accounts and prior acknowledged progress', async () => {
  const sent: number[][] = [];
  const client = createUsersAdminClient({
    request: async <T>(_path: string, decode: (value: unknown) => T, options: ApiRequestOptions = {}) => {
      const body = options.body as { ids: number[] };
      sent.push(body.ids);
      if (sent.length === 2) throw new Error('connection lost');
      return decode({ success: true, ids: body.ids, actor_deleted: false });
    }
  });
  const self = decodeUser({ ...raw, id: 1, is_self: true }),
    other = decodeUser(raw),
    progress: number[] = [];
  const result = await client.bulkAll('delete', [self, other], 1, 7, (count) => progress.push(count));
  expect(sent).toEqual([[2], [1]]);
  expect(progress).toEqual([1]);
  expect(result.completed.map((user) => user.id)).toEqual([2]);
  expect(result.remaining.map((user) => user.id)).toEqual([1]);
  expect(result.actorDeleted).toBe(false);
  expect(result.error).toBeInstanceOf(Error);
});

test('leaving the native screen stops later bulk batches while retaining confirmed progress', async () => {
  let writes = 0;
  const controller = new AbortController(),
    first = decodeUser(raw),
    second = decodeUser({ ...raw, id: 3 });
  const client = createUsersAdminClient({
    request: async <T>(_path: string, decode: (value: unknown) => T, options: ApiRequestOptions = {}) => {
      writes++;
      return decode({ success: true, ids: (options.body as { ids: number[] }).ids, actor_deleted: false });
    }
  });
  const result = await client.bulkAll('delete', [first, second], 1, 7, () => controller.abort(), controller.signal);
  expect(writes).toBe(1);
  expect(result.completed.map((user) => user.id)).toEqual([2]);
  expect(result.remaining.map((user) => user.id)).toEqual([3]);
});
test('stopping at the last resolved selection page never acknowledges that cancelled selection', async () => {
  const controller = new AbortController();
  const client = createUsersAdminClient({
    request: async <T>(_path: string, decode: (value: unknown) => T) =>
      decode({ data: [raw], current_page: 1, last_page: 1, total: 1, per_page: 100 })
  });
  await expect(
    client.selectAll({ query: '', sort: 'name', direction: 'asc', trashed: 'without', page: 1, perPage: 25 }, 7, controller.signal, () =>
      controller.abort()
    )
  ).rejects.toThrow();
});
