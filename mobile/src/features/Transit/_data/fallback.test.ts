import { focusTransitMapData } from '../model';
import damascusRoutes from './damascus/routes';
import { transitFallback } from './fallback';

const fallbackCities = ['damascus', 'hama', 'tartous'] as const;

test.each(fallbackCities)(
  'normalizes the %s fallback to the native map contract',
  (cityId) => {
    const fallback = transitFallback(cityId);

    expect(fallback).not.toBeNull();
    expect(Object.keys(fallback!.routes).sort()).toEqual(['features', 'type']);
    expect(Object.keys(fallback!.stops).sort()).toEqual(['features', 'type']);

    const routeIds = new Set(
      fallback!.routes.features.map((route) => route.properties.id),
    );
    for (const stop of fallback!.stops.features) {
      expect(stop.properties.routeIds).toEqual([expect.any(String)]);
      expect(stop.properties).not.toHaveProperty('routeId');
      expect(routeIds.has(stop.properties.routeIds[0]!)).toBe(true);
    }

    const routeId = fallback!.stops.features[0]?.properties.routeIds[0];
    expect(routeId).toBeDefined();
    const focused = focusTransitMapData(fallback!, routeId);
    expect(focused.stops.features.length).toBeGreaterThan(0);
    expect(
      focused.stops.features.every(
        (stop) => stop.properties.routeIds.includes(routeId!),
      ),
    ).toBe(true);
  },
);

test('returns no fallback for a city without bundled geometry', () => {
  expect(transitFallback('aleppo')).toBeNull();
});

test('reuses immutable bundled route coordinates', () => {
  const fallback = transitFallback('damascus');

  expect(fallback!.routes.features[0]!.geometry.coordinates).toBe(
    damascusRoutes.features[0]!.geometry.coordinates,
  );
});
