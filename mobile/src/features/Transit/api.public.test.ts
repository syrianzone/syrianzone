import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { getCityRoutes } from './api';

afterEach(() => jest.restoreAllMocks());

test('keeps the source route stop count in the public route response', async () => {
  jest.spyOn(apiClient, 'request').mockImplementation(
    async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
      expect(path).toBe('/api/v1/cities/damascus/routes');
      return options.schema.parse([
        {
          colorIndex: 2,
          id: 'route-a',
          nameAr: 'خط الاختبار',
          nameEn: 'Test route',
          priceNew: 2500,
          stopsCount: 12,
        },
      ]);
    },
  );

  await expect(getCityRoutes('damascus')).resolves.toEqual([
    expect.objectContaining({ id: 'route-a', stopsCount: 12 }),
  ]);
});
