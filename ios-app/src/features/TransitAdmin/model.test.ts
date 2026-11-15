import { expect, test } from 'bun:test';
import {
  canInCity,
  combinePayload,
  decodeDrafts,
  decodeGeometry,
  decodeImportPreview,
  decodeRoutes,
  filterDrafts,
  filterRoutes,
  importForm,
  importPayload,
  nextPending,
  routePayload,
  splitPayload,
  validateImportFile
} from './model';

const line = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      [
        [36, 33],
        [36.1, 33.1]
      ],
      [
        [36.2, 33.2],
        [36.3, 33.3]
      ]
    ]
  }
};
const stop = { type: 'Feature', properties: { nameAr: 'الميدان' }, geometry: { type: 'Point', coordinates: [36.1, 33.1] } };
const geojson = { type: 'FeatureCollection', features: [line, stop] };
const rawDraft = {
  id: 1,
  city_id: 'damascus',
  name_ar: 'خط الميدان',
  name_en: null,
  color_index: 3,
  price: 5000,
  notes: null,
  status: 'pending',
  rejection_reason: null,
  route_id: 'route-old',
  created_at: '2026-11-01T12:00:00Z',
  city: { name_ar: 'دمشق' },
  user: null,
  linked_route: { name_ar: 'القديم' },
  geojson: JSON.stringify(geojson)
};
const rawRoute = {
  id: 'route-old',
  city_id: 'damascus',
  name_ar: 'أُوتوستراد',
  name_en: 'Highway',
  color_index: 3,
  price_new: 5000,
  price_old: null,
  status: 'hidden',
  stops_count: 2,
  created_at: '2026-11-01T12:00:00Z',
  city: null
};

test('draft decoder retains linked edits, nullable contributors and every geometry segment', () => {
  const draft = decodeDrafts([rawDraft])[0]!;
  expect(draft.linkedName).toBe('القديم');
  expect(draft.user).toBeNull();
  expect(draft.geometry.segments).toHaveLength(2);
  expect(draft.geometry.stops[0]).toEqual({ name: 'الميدان', coordinate: { longitude: 36.1, latitude: 33.1 } });
});
test('moderation next pending respects visible city and status order and never selects the acted draft', () => {
  const rows = decodeDrafts([
    rawDraft,
    { ...rawDraft, id: 2, created_at: '2026-11-02T12:00:00Z' },
    { ...rawDraft, id: 3, city_id: 'aleppo' },
    { ...rawDraft, id: 4, status: 'approved' }
  ]);
  expect(filterDrafts(rows, 'pending', 'damascus').map((item) => item.id)).toEqual([2, 1]);
  expect(nextPending(rows, 'all', 'damascus', 2)).toBe(1);
  expect(nextPending(rows, 'approved', 'damascus', 4)).toBeNull();
  expect(nextPending([rows[0]!], 'all', 'all', 1)).toBeNull();
});
test('published filters match Arabic search and retain hidden routes only when selected', () => {
  const rows = decodeRoutes([rawRoute, { ...rawRoute, id: 'other', city_id: 'aleppo', status: 'published' }]);
  expect(filterRoutes(rows, 'hidden', 'damascus', 'اوتوستراد').map((item) => item.id)).toEqual(['route-old']);
  expect(filterRoutes(rows, 'published', 'damascus', '')).toEqual([]);
});
test('native controls use the resolved capability and governorate scope without role inference', () => {
  expect(canInCity(['transit.approve'], ['damascus'], 'transit.approve', 'damascus')).toBe(true);
  expect(canInCity(['transit.approve'], ['damascus'], 'transit.approve', 'aleppo')).toBe(false);
  expect(canInCity(['transit.approve'], null, 'transit.reject', 'damascus')).toBe(false);
  expect(canInCity(['transit.edit_routes'], null, 'transit.edit_routes', 'aleppo')).toBe(true);
});
test('route metadata updates distinguish an empty price from zero and reject partial integers', () => {
  expect(routePayload({ nameAr: ' خط ', nameEn: '', price: '', color: 0 })).toEqual({
    name_ar: 'خط',
    name_en: null,
    price_new: null,
    color_index: 0
  });
  expect(routePayload({ nameAr: 'خط', nameEn: 'Route', price: '0', color: 3 }).price_new).toBe(0);
  expect(() => routePayload({ nameAr: 'خط', nameEn: '', price: '12abc', color: 0 })).toThrow();
  expect(() => routePayload({ nameAr: 'خط', nameEn: '', price: '1', color: 21 })).toThrow();
});
test('combine rejects the same route and routes across cities before dispatch', () => {
  const route = decodeRoutes([{ ...rawRoute, status: 'published' }])[0]!;
  expect(() => combinePayload(route, route, 'دمج', '', '')).toThrow();
  expect(() => combinePayload(route, { ...route, id: 'different', cityId: 'aleppo' }, 'دمج', '', '')).toThrow();
  expect(combinePayload(route, { ...route, id: 'different' }, 'دمج', '', '').price).toBeNull();
  for (const status of ['hidden', 'disapproved'] as const)
    expect(() => combinePayload(route, { ...route, id: 'different', status }, 'دمج', '', '')).toThrow();
});
test('split accepts only an interior stop from the current route', () => {
  const stops = [
    { id: 'a', name: 'أ' },
    { id: 'b', name: 'ب' },
    { id: 'c', name: 'ج' }
  ];
  expect(splitPayload('route-old', stops, 'b', ['الأول', '', 'الثاني', '']).split_stop_id).toBe('b');
  for (const id of ['a', 'c', 'foreign']) expect(() => splitPayload('route-old', stops, id, ['الأول', '', 'الثاني', ''])).toThrow();
});
test('import stop edits retain every line part and source metadata without changing the candidate', () => {
  const preview = decodeImportPreview({
    mid: 'map-id',
    scope_filtered: 1,
    routes: [
      {
        name_ar: 'استيراد',
        name_en: null,
        notes: 'المصدر',
        price: null,
        geojson,
        vertex_count: 4,
        stop_count: 1,
        bounds: [36, 33, 36.3, 33.3],
        warnings: ['تحذير'],
        source: { doc_name: 'خريطة', doc_description: null },
        suggested_city_id: 'damascus'
      }
    ]
  });
  const candidate = preview.candidates[0]!,
    form = importForm(candidate, 'damascus');
  const payload = importPayload(candidate, { ...form, stops: [] }, 'draft', preview.mid);
  expect(payload.geojson.features).toHaveLength(1);
  expect(payload.geojson.features[0]!.geometry.type).toBe('MultiLineString');
  expect(payload.source_mid).toBe('map-id');
  expect(candidate.geometry.stops).toHaveLength(1);
  expect(preview.filtered).toBe(1);
  expect(() => importPayload(candidate, { ...form, price: '1000001' }, 'direct', preview.mid)).toThrow();
});
test('malformed identities, geometry and route status fail before entering controls', () => {
  expect(() => decodeRoutes([{ ...rawRoute, id: '../../route' }])).toThrow();
  expect(() => decodeRoutes([{ ...rawRoute, status: 'unknown' }])).toThrow();
  expect(() => decodeGeometry({ type: 'FeatureCollection', features: [{ ...stop, geometry: { type: 'Point', coordinates: [36, 100] } }] })).toThrow();
  expect(() =>
    decodeGeometry({ type: 'FeatureCollection', features: [{ ...line, geometry: { type: 'LineString', coordinates: [[36, 33]] } }] })
  ).toThrow();
});
test('native file import enforces source file types and five MiB before upload', () => {
  expect(() => validateImportFile({ name: 'route.kmz', size: 5 * 1024 * 1024 })).not.toThrow();
  expect(() => validateImportFile({ name: 'route.kml', size: 5 * 1024 * 1024 + 1 })).toThrow();
  expect(() => validateImportFile({ name: 'route.exe', size: 20 })).toThrow();
});
