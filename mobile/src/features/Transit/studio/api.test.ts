import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import { submitRouteDraft } from '../api';

describe('transit studio submission API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('submits the route line and ordered Point stop features', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        expect(path).toBe('/api/v1/studio/routes');
        expect(options.method).toBe('POST');
        expect(options.body).toMatchObject({
          city_id: 'damascus',
          geojson: {
            features: [
              { geometry: { type: 'LineString' } },
              {
                geometry: { coordinates: [36.25, 33.45], type: 'Point' },
                properties: { nameAr: 'البرامكة', type: 'stop' },
              },
            ],
            type: 'FeatureCollection',
          },
          name_ar: 'باب توما إلى البرامكة',
        });
        return options.schema.parse({ id: 42 });
      },
    );

    await expect(
      submitRouteDraft({
        cityId: 'damascus',
        coordinates: [
          [36.2, 33.4],
          [36.3, 33.5],
        ],
        nameAr: 'باب توما إلى البرامكة',
        stops: [{ coordinates: [36.25, 33.45], nameAr: 'البرامكة' }],
      }),
    ).resolves.toEqual({ id: 42 });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
