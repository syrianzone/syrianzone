import { apiClient, type ApiRequestOptions } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

import { getCityRoutes, getRouteDetail } from './api';

const mapData = {
  routes: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[36.2, 33.4], [36.3, 33.5]] },
        properties: { colorIndex: 2, id: 'route-a', nameAr: 'خط الاختبار', priceNew: 2500 },
      },
    ],
  },
  stops: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [36.2, 33.4] },
        properties: { id: 'stop-a', nameAr: 'الموقف الأول', routeIds: ['route-a'] },
      },
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [36.9, 33.9] },
        properties: { id: 'stop-z', nameAr: 'موقف آخر', routeIds: ['route-z'] },
      },
    ],
  },
};

// The mobile route 404s like production does today; the v1 map data answers.
function mockMobileMissing() {
  return jest.spyOn(apiClient, 'request').mockImplementation(
    async <T>(path: string, options: ApiRequestOptions<T>): Promise<T> => {
      if (path.startsWith('/api/mobile/')) {
        throw new ApiError(404, 'http_404', 'Not Found');
      }
      expect(path).toBe('/api/v1/cities/damascus/map-data');
      return options.schema.parse(mapData);
    },
  );
}

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

test('builds the route page from live map data when the mobile route is missing', async () => {
  mockMobileMissing();

  const detail = await getRouteDetail('damascus', 'route-a');

  expect(detail.city.nameAr).toBe('دمشق');
  expect(detail.route).toMatchObject({ id: 'route-a', priceNew: 2500 });
  expect(detail.stops.map((stop) => stop.properties.id)).toEqual(['stop-a']);
});

test('reports an unknown route as not found after the fallback', async () => {
  mockMobileMissing();

  await expect(getRouteDetail('damascus', 'route-z')).rejects.toMatchObject({
    status: 404,
  });
});

test('surfaces other mobile route errors without falling back', async () => {
  jest.spyOn(apiClient, 'request').mockRejectedValue(new ApiError(500, 'http_500', 'boom'));

  await expect(getRouteDetail('damascus', 'route-a')).rejects.toMatchObject({ status: 500 });
});
