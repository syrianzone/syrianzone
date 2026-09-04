import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import {
  createManagedUser,
  deleteManagedUser,
  fetchManagedUsers,
  toggleManagedUserBan,
} from './usersApi';

const user = {
  avatar_url: null,
  created_at: '2026-07-16T10:00:00Z',
  email: 'reviewer@example.test',
  id: 42,
  is_banned: false,
  name: 'Reviewer',
  role: 'transit_admin' as const,
};

describe('mobile user administration API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('maps list, create, ban, and delete to protected mobile routes', async () => {
    const calls: { body?: unknown; method: string; path: string }[] = [];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        calls.push({
          ...(options.body === undefined ? {} : { body: options.body }),
          method: options.method ?? 'GET',
          path,
        });
        expect(options.auth).toBe(true);
        const payload =
          options.method === 'DELETE'
            ? { data: { deleted: true } }
            : path.endsWith('/toggle-ban')
              ? {
                  data: {
                    user: { id: user.id, is_banned: true, name: user.name },
                  },
                }
              : options.method === 'POST'
                ? { data: user }
                : { data: [user] };
        return options.schema.parse(payload);
      },
    );

    await fetchManagedUsers();
    await createManagedUser({
      email: user.email,
      name: user.name,
      role: 'transit_admin',
    });
    const toggled = await toggleManagedUserBan(user.id, true);
    await deleteManagedUser(user.id);

    expect(toggled).toEqual({ id: user.id, is_banned: true, name: user.name });
    expect(calls).toEqual([
      { method: 'GET', path: '/api/mobile/admin/users' },
      {
        body: {
          email: user.email,
          name: user.name,
          role: 'transit_admin',
        },
        method: 'POST',
        path: '/api/mobile/admin/users',
      },
      {
        body: { is_banned: true },
        method: 'POST',
        path: '/api/mobile/admin/users/42/toggle-ban',
      },
      { method: 'DELETE', path: '/api/mobile/admin/users/42' },
    ]);
  });

  test('keeps every row when the payload mixes directory admin and unknown roles', async () => {
    const roles = [
      'superadmin',
      'admin',
      'transit_admin',
      'syofficial_admin',
      'govapps_admin',
      'phonebook_admin',
      'user',
      'future_admin',
    ];
    jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
        options.schema.parse({
          data: roles.map((role, index) => ({
            ...user,
            id: index + 1,
            role,
          })),
        }),
    );

    await expect(
      fetchManagedUsers().then((list) => list.map((item) => item.role)),
    ).resolves.toEqual(roles);
  });
});
