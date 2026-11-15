import { expect, test } from 'bun:test';
import { decodeCities, decodeNearby, decodeRouteMetadata, decodeTransitSearch, groupRoutes, routesForStop } from './model';

const city = { id: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', status: 'active', routeCount: 3, center: [36.3, 33.5], bounds: [[36, 33], [37, 34]], zoom: 12, mapGroup: ['damascus', 'rif-dimashq'], mapGroupLabel: 'دمشق الكبرى', icon: { viewBox: '0 0 10 10', path: 'M0 0L10 0L5 10Z' } };
test('native cities retain the actual shared map membership, camera and original outline', () => {
  const result = decodeCities([city]);
  expect(result[0]).toMatchObject({ id: 'damascus', mapGroup: ['damascus', 'rif-dimashq'], mapGroupLabel: 'دمشق الكبرى', zoom: 12, icon: city.icon });
  expect(result[0]?.coordinates).toEqual({ latitude: 33.5, longitude: 36.3 });
  expect(() => decodeCities([{ ...city, icon: { viewBox: 'bad', path: 'M0 0' } }])).toThrow();
});
test('shared-map route groups follow server city membership instead of hardcoded pairs', () => {
  const routes = decodeRouteMetadata([{ id: 'one', cityId: 'rif-dimashq', nameAr: 'ريف', nameEn: null, colorIndex: 999, priceOld: 1000, priceNew: 10, stopsCount: 2 }, { id: 'two', cityId: 'damascus', nameAr: 'مدينة', nameEn: 'City', colorIndex: 1, priceOld: null, priceNew: null, stopsCount: 0 }]);
  expect(groupRoutes(decodeCities([city])[0]!, routes, decodeCities([city])).map(group => [group.id, group.routes.map(route => route.id)])).toEqual([['damascus', ['two']], ['rif-dimashq', ['one']]]);
  expect(routes[1]?.nameEn).toBe('City'); expect(routes[0]?.priceNew).toBe(10);
});
test('nearby stops keep route chips and actual city so another-city routes can be opened', () => {
  const stops = decodeNearby([{ id: 'stop', nameAr: 'موقف', cityId: 'aleppo', coordinates: [37.16, 36.2], routes: [{ id: 'route', name_ar: 'خط' }] }]);
  expect(stops[0]).toMatchObject({ cityId: 'aleppo', coordinate: { latitude: 36.2, longitude: 37.16 }, routes: [{ id: 'route', name: 'خط' }] });
  expect(routesForStop(stops[0]!, [], 'damascus')).toEqual([{ id: 'route', name: 'خط', cityId: 'aleppo' }]);
});
test('remote search preserves route and stop identities and rejects a false stop coordinate', () => {
  expect(decodeTransitSearch({ routes: [{ type: 'route', id: 'r', nameAr: 'خط', cityId: 'aleppo' }], stops: [] }).routes[0]?.id).toBe('r');
  expect(() => decodeTransitSearch({ routes: [], stops: [{ type: 'stop', id: 's', nameAr: 'موقف', cityId: 'aleppo', coordinates: [200, 30] }] })).toThrow();
});
