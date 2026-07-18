import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { contributorSchema, fetchContributors } from './api';

describe('Syrian contributor API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('validates every contribution counter at the public boundary', () => {
    expect(
      contributorSchema.safeParse({
        avatar_url: '',
        daily_contributions: 1,
        monthly_contributions: 2,
        total_contributions: 4,
        username: 'z44d',
        yearly_contributions: 3,
      }).success,
    ).toBe(true);
    expect(
      contributorSchema.safeParse({
        avatar_url: '',
        daily_contributions: -1,
        monthly_contributions: 2,
        total_contributions: 4,
        username: 'z44d',
        yearly_contributions: 3,
      }).success,
    ).toBe(false);
  });

  test('uses the unauthenticated mobile contributor endpoint', async () => {
    const request = jest
      .spyOn(apiClient, 'request')
      .mockImplementation(
        async <T>(
          path: string,
          options: ApiRequestOptions<T>,
        ): Promise<T> => {
          expect(path).toBe('/api/mobile/contributors');
          expect(options.auth).toBe(false);
          return options.schema.parse({ data: [] });
        },
      );

    await expect(fetchContributors()).resolves.toEqual([]);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
