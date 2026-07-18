import type { MapDataResponse } from './_types';
import {
  focusTransitMapData,
  getGovernorateSvgKey,
  routeCameraTarget,
  transitSummary,
  transitThemeForApp,
} from './model';

const mapData: MapDataResponse = {
  routes: {
    features: [
      {
        geometry: {
          coordinates: [
            [36.1, 33.4],
            [36.5, 33.8],
          ],
          type: 'LineString',
        },
        properties: { colorIndex: 1, id: 'route-a', nameAr: 'الخط أ' },
        type: 'Feature',
      },
      {
        geometry: {
          coordinates: [
            [37, 34],
            [37.2, 34.2],
          ],
          type: 'LineString',
        },
        properties: { colorIndex: 2, id: 'route-b', nameAr: 'الخط ب' },
        type: 'Feature',
      },
    ],
    type: 'FeatureCollection',
  },
  stops: {
    features: [
      {
        geometry: { coordinates: [36.2, 33.5], type: 'Point' },
        properties: { id: 'stop-a', nameAr: 'موقف أ', routeIds: ['route-a'] },
        type: 'Feature',
      },
      {
        geometry: { coordinates: [37.1, 34.1], type: 'Point' },
        properties: { id: 'stop-b', nameAr: 'موقف ب', routeIds: ['route-b'] },
        type: 'Feature',
      },
    ],
    type: 'FeatureCollection',
  },
};

test('summarizes ready cities and all published routes', () => {
  expect(
    transitSummary([
      { routeCount: 4, status: 'active' },
      { routeCount: 0, status: 'active' },
      { routeCount: 8, status: 'coming_soon' },
    ]),
  ).toEqual({ readyCities: 1, totalRoutes: 4 });
});

test('focuses a route with only its stops and computes its camera bounds', () => {
  const focused = focusTransitMapData(mapData, 'route-a');

  expect(focused.routes.features.map((route) => route.properties.id)).toEqual([
    'route-a',
  ]);
  expect(focused.stops.features.map((stop) => stop.properties.id)).toEqual([
    'stop-a',
  ]);
  expect(routeCameraTarget(focused.routes)).toEqual({
    bounds: [36.1, 33.4, 36.5, 33.8],
    kind: 'bounds',
  });
});

test('uses a fixed close-up target for tiny route geometry', () => {
  const focused = focusTransitMapData(mapData, 'route-a');
  focused.routes.features[0]!.geometry.coordinates = [
    [36.1, 33.4],
    [36.1002, 33.4002],
  ];

  expect(routeCameraTarget(focused.routes)).toEqual({
    center: [36.1001, 33.4001],
    kind: 'center',
    zoom: 14,
  });
  expect(focusTransitMapData(mapData, 'missing').routes.features).toEqual([]);
});

test('maps all governorate aliases and global light state', () => {
  expect(getGovernorateSvgKey('tartous')).toBe('tartus');
  expect(getGovernorateSvgKey('deir-ezzor')).toBe('dayr az zawr');
  expect(getGovernorateSvgKey('hasakah')).toBe('al Ḥasakah');
  expect(transitThemeForApp(false)).toBe('jasmine');
  expect(transitThemeForApp(true)).toBe('damascus-rose');
});
