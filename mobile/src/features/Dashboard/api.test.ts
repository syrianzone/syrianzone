import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import {
  deleteDashboardAccount,
  fetchDashboardAccount,
  updateDashboardAccount,
  withdrawDashboardDraft,
} from './api';

const user = {
  avatar_url: null,
  email: 'admin@example.test',
  id: 7,
  is_banned: false,
  name: 'Admin',
  role: 'admin',
};

describe('dashboard account API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses bearer account reads and keeps the submissions envelope', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => {
          expect(path).toBe('/api/mobile/account');
          expect(options.auth).toBe(true);
          return options.schema.parse({ data: { myDrafts: [], user } });
        },
      );

    await expect(fetchDashboardAccount()).resolves.toEqual({
      myDrafts: [],
      user,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('sends profile updates as PATCH and returns the refreshed user', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          _path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => options.schema.parse({ data: { user } }),
      );

    await updateDashboardAccount({
      email: 'admin@example.test',
      name: 'Admin',
    });

    expect(request).toHaveBeenCalledWith('/api/mobile/account', {
      auth: true,
      body: { email: 'admin@example.test', name: 'Admin' },
      method: 'PATCH',
      schema: expect.anything(),
    });
  });

  test('uses DELETE and validates the irreversible deletion receipt', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          _path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> =>
          options.schema.parse({ data: { deleted: true } }),
      );

    await deleteDashboardAccount();

    expect(request).toHaveBeenCalledWith('/api/mobile/account', {
      auth: true,
      method: 'DELETE',
      schema: expect.anything(),
    });
  });

  test('withdraws a pending draft through the owner account endpoint', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          _path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => options.schema.parse({ data: { deleted: true } }),
      );

    await withdrawDashboardDraft(42);

    expect(request).toHaveBeenCalledWith(
      '/api/mobile/account/transit-drafts/42',
      {
        auth: true,
        method: 'DELETE',
        schema: expect.anything(),
      },
    );
  });
});
