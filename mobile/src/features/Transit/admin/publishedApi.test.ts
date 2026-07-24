import { apiClient, type ApiRequestOptions } from '@/lib/api/client';

import {
  combinePublishedRoutes,
  getPublishedRouteGeoJson,
  getPublishedRouteStops,
  getPublishedRoutes,
  getTransitRouteLogs,
  movePublishedRoute,
  splitPublishedRoute,
  updatePublishedRoute,
  updatePublishedRouteStatus,
} from '../api';

describe('published route administration API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('reads routes, logs, geometry, and ordered stops with bearer auth', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
        expect(options.auth).toBe(true);
        if (path.endsWith('/geojson')) {
          return options.schema.parse({
            features: [],
            type: 'FeatureCollection',
          });
        }
        if (path.endsWith('/stops')) {
          return options.schema.parse([
            {
              coordinates: [36.2, 33.4],
              id: 'stop-a',
              name_ar: 'الموقف الأول',
            },
          ]);
        }
        if (path.endsWith('/logs')) {
          return options.schema.parse([
            {
              action: 'moved',
              created_at: '2026-07-24T10:00:00Z',
              description: 'نقل الخط',
              id: 1,
              route_id: 'route-a',
              user: { name: 'مدير' },
            },
          ]);
        }
        return options.schema.parse([
          {
            city: { name_ar: 'دمشق', name_en: 'Damascus' },
            city_id: 'damascus',
            color_index: 4,
            created_at: '2026-07-24T10:00:00Z',
            id: 'route-a',
            name_ar: 'خط تجريبي',
            name_en: 'Test route',
            price_new: 2_500,
            price_old: null,
            status: 'published',
            stops_count: 1,
          },
        ]);
      },
    );

    const routes = await getPublishedRoutes();
    await getTransitRouteLogs();
    await getPublishedRouteGeoJson('route-a');
    await getPublishedRouteStops('route-a');

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/mobile/admin/routes',
      '/api/mobile/admin/routes/logs',
      '/api/mobile/admin/routes/route-a/geojson',
      '/api/mobile/admin/routes/route-a/stops',
    ]);
    expect(routes[0]?.color_index).toBe(4);
  });

  test('posts every published route mutation to its native endpoint', async () => {
    const request = jest.spyOn(apiClient, 'request').mockImplementation(
      async <T>(_path: string, options: ApiRequestOptions<T>): Promise<T> =>
        options.schema.parse({ message: 'ok' }),
    );

    await updatePublishedRouteStatus('route-a', 'hidden');
    await updatePublishedRoute('route-a', {
      colorIndex: 7,
      nameAr: 'خط معدل',
      nameEn: 'Updated route',
      priceNew: 3_000,
      priceOld: 2_000,
    });
    await movePublishedRoute('route-a', 'hama');
    await combinePublishedRoutes({
      nameAr: 'خط مدمج',
      nameEn: null,
      price: 4_000,
      routeAId: 'route-a',
      routeBId: 'route-b',
    });
    await splitPublishedRoute({
      nameAAr: 'القسم الأول',
      nameAEn: null,
      nameBAr: 'القسم الثاني',
      nameBEn: null,
      routeId: 'route-a',
      splitStopId: 'stop-b',
    });

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/api/mobile/admin/routes/route-a/status',
      '/api/mobile/admin/routes/route-a',
      '/api/mobile/admin/routes/route-a/move',
      '/api/mobile/admin/routes/combine',
      '/api/mobile/admin/routes/split',
    ]);
    expect(request.mock.calls.every(([, options]) => options.auth === true)).toBe(
      true,
    );
    expect(request.mock.calls[1]?.[1].body).toEqual({
      color_index: 7,
      name_ar: 'خط معدل',
      name_en: 'Updated route',
      price_new: 3_000,
      price_old: 2_000,
    });
  });
});
