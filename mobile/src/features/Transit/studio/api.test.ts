import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import {
  getPublishedRouteForEdit,
  getTransitStudioDraft,
  saveRouteDraft,
  submitRouteDraft,
} from '../api';

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

  test('loads owned drafts and published routes through bearer contracts', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        expect(options.auth).toBe(true);
        return options.schema.parse({
          city_id: 'damascus',
          geojson: { features: [], type: 'FeatureCollection' },
          id: path.endsWith('/from-route') ? 'route-a' : 42,
          is_published_route: path.endsWith('/from-route'),
          name_ar: 'خط تجريبي',
          name_en: null,
          notes: null,
          price: null,
          route_id: path.endsWith('/from-route') ? 'route-a' : null,
        });
      },
    );

    await expect(getTransitStudioDraft(42)).resolves.toMatchObject({ id: 42 });
    await expect(getPublishedRouteForEdit('route-a')).resolves.toMatchObject({
      is_published_route: true,
      route_id: 'route-a',
    });
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/v1/studio/routes/42',
      '/api/v1/studio/routes/route-a/from-route',
    ]);
  });

  test('updates an existing draft with PUT', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
        options.schema.parse({ id: 42 }),
    );

    await saveRouteDraft({
      cityId: 'damascus',
      coordinates: [[36.2, 33.4], [36.3, 33.5]],
      draftId: 42,
      nameAr: 'خط معدل',
      stops: [],
    });

    expect(request).toHaveBeenCalledWith('/api/v1/studio/routes/42', expect.objectContaining({
      auth: true,
      method: 'PUT',
    }));
  });

  test('creates a linked draft when editing a published route', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
        options.schema.parse({ id: 43 }),
    );

    await saveRouteDraft({
      cityId: 'damascus',
      coordinates: [[36.2, 33.4], [36.3, 33.5]],
      nameAr: 'تعديل خط منشور',
      routeId: 'route-a',
      stops: [],
    });

    expect(request).toHaveBeenCalledWith('/api/v1/studio/routes', expect.objectContaining({
      auth: true,
      body: expect.objectContaining({ route_id: 'route-a' }),
      method: 'POST',
    }));
  });
});
