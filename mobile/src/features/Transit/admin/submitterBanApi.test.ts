import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { toggleTransitSubmitterBan } from '../api';

describe('transit submitter moderation API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('posts desired ban state through the bounded mobile contract', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        expect(path).toBe('/api/mobile/admin/users/7/toggle-ban');
        expect(options).toMatchObject({
          auth: true,
          body: { is_banned: true },
          method: 'POST',
        });
        return options.schema.parse({
          data: { user: { id: 7, is_banned: true, name: 'مساهم' } },
        });
      },
    );

    const actual = await toggleTransitSubmitterBan(7, true);

    expect(actual).toEqual({ id: 7, is_banned: true, name: 'مساهم' });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
