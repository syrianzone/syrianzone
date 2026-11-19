import { describe, expect, test } from 'bun:test';
import searchCases from '../../resources/data/search-fold.json';
import transitFacts from '../../resources/data/transit.json';
import { matchesSearch, normalizeSearch, parseCities, parseNearbyStops, parsePlaceDetail, parsePlacePage, parseTransitMap, routeColor, stopsForRoute } from './domain';

const point = [36.3, 33.5];
const city = { id: 'damascus', nameAr: 'دمشق', nameEn: 'Damascus', center: point, routeCount: 2, status: 'active' };
const place = { id: 217, name: 'جامعة دمشق', category: 'historical', description: null, lat: 33.5, lng: 36.3, thumb_url: null, saves_count: 1 };
const stop = { type: 'Feature', geometry: { type: 'Point', coordinates: point }, properties: { id: 'stop-1', nameAr: 'المحطة', routeIds: ['route-1'] } };
const route = { type: 'Feature', geometry: { type: 'LineString', coordinates: [point, [36.4, 33.6]] }, properties: { id: 'route-1', nameAr: 'الخط الأول', colorIndex: 2, priceOld: null, priceNew: 25 } };
const map = { routes: { type: 'FeatureCollection', features: [route] }, stops: { type: 'FeatureCollection', features: [stop] } };

describe('public API decoding', () => {
  test('converts GeoJSON longitude first into native map coordinates', () => {
    expect(parseCities([city])[0]).toMatchObject({ id: 'damascus', name: 'دمشق', coordinates: { latitude: 33.5, longitude: 36.3 }, comingSoon: false });
  });

  test('keeps unavailable city centers nullable and marks coming soon cities', () => {
    expect(parseCities([{ ...city, center: null, status: 'coming_soon' }])[0]).toMatchObject({ coordinates: null, comingSoon: true });
  });

  test('preserves disconnected route segments and derives associated stops', () => {
    const payload = { ...map, routes: { type: 'FeatureCollection', features: [{ ...route, geometry: { type: 'MultiLineString', coordinates: [[point, [36.4, 33.6]], [[36.5, 33.7], [36.6, 33.8]]] } }] } };
    const parsed = parseTransitMap(payload);
    expect(parsed.routes[0]?.segments).toHaveLength(2);
    expect(parsed.routes[0]?.stopIds).toEqual(['stop-1']);
    expect(stopsForRoute(parsed, 'route-1')).toEqual(parsed.stops);
    expect(stopsForRoute(parsed, 'another-route')).toEqual([]);
  });

  test('rejects malformed geometry, ids, and out of range coordinates', () => {
    expect(() => parseCities([{ ...city, center: [181, 33] }])).toThrow();
    expect(() => parseCities([{ ...city, id: '../elsewhere' }])).toThrow();
    expect(() => parseCities([{ ...city, routeCount: -1 }])).toThrow();
    expect(() => parseTransitMap({ ...map, routes: { type: 'FeatureCollection', features: [{ ...route, geometry: { type: 'Polygon', coordinates: [] } }] } })).toThrow();
    expect(() => parseTransitMap({ ...map, stops: { type: 'FeatureCollection', features: [{ ...stop, geometry: { type: 'Point', coordinates: [36, Number.NaN] } }] } })).toThrow();
  });

  test('decodes place pagination and nullable photo fields', () => {
    expect(parsePlacePage({ data: [place], current_page: 1, last_page: 3, total: 41 })).toEqual({
      items: [{ id: 217, name: 'جامعة دمشق', category: 'historical', description: null, coordinate: { latitude: 33.5, longitude: 36.3 }, thumbnail: null, savesCount: 1 }],
      currentPage: 1, lastPage: 3, total: 41,
    });
  });

  test('decodes detail photos and contributor without exposing account fields', () => {
    expect(parsePlaceDetail({ ...place, user: { name: 'مساهم', email: 'private@example.test' }, photos: [{ id: 1, thumb_url: null, display_url: 'https://images.example.test/photo.webp' }] })).toMatchObject({
      contributor: 'مساهم', photos: [{ id: 1, thumbnail: null, url: 'https://images.example.test/photo.webp' }],
    });
  });

  test('rejects unsafe photo URLs, invalid pagination, and unknown categories', () => {
    expect(() => parsePlaceDetail({ ...place, photos: [{ id: 1, display_url: 'javascript:alert(1)' }] })).toThrow();
    expect(() => parsePlacePage({ data: [{ ...place, thumb_url: 'https://user:password@example.test/a' }], current_page: 1, last_page: 1, total: 1 })).toThrow();
    expect(() => parsePlacePage({ data: [{ ...place, category: 'unknown' }], current_page: 1, last_page: 1, total: 1 })).toThrow();
    expect(() => parsePlacePage({ data: [], current_page: 0, last_page: 1, total: 0 })).toThrow();
  });

  test('decodes nearby stops and keeps route membership', () => {
    expect(parseNearbyStops([{ id: 'stop-1', nameAr: 'المحطة', coordinates: point, routes: [{ id: 'route-1', name_ar: 'الخط' }] }])).toEqual([
      { id: 'stop-1', name: 'المحطة', coordinate: { latitude: 33.5, longitude: 36.3 }, routeIds: ['route-1'] },
    ]);
  });
});

test('Arabic search ignores tashkeel, tatweel, and alef variants', () => {
  expect(matchesSearch('إِدْلِب', 'ادلب')).toBe(true);
  expect(matchesSearch('حَـلَب', 'حلب')).toBe(true);
  expect(matchesSearch('Damascus', 'DAM')).toBe(true);
  expect(matchesSearch('دمشق', 'حلب')).toBe(false);
});

test('wraps valid route color indexes through the shared source palette', () => {
  expect(routeColor(0)).toBe('#e8a838');
  expect(routeColor(null)).toBe(routeColor(0));
  expect<string | undefined>(routeColor(999)).toBe(transitFacts.route_palette[999 % transitFacts.route_palette.length]);
  expect(routeColor(transitFacts.route_palette.length + 2)).toBe(routeColor(2));
  expect(routeColor(-1)).toBe(routeColor(0));
});

test('search folding matches the server golden cases', () => {
  for (const item of searchCases) expect(normalizeSearch(item.input)).toBe(item.fold);
});
