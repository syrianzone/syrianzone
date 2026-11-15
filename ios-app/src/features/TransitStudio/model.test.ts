import { expect, test } from 'bun:test';
import { buildPayload, decodeStudioDraft, emptyDraft, nearestOnRoute, replaceVertex, overlapsRoute, studioCities, restoreGeometry } from './model';
import { decodeCities } from '../Transit/model';

test('Studio writes original longitude/latitude geometry and a real nullable integer price', () => {
  const draft = { ...emptyDraft('damascus'), nameAr: '  خط جديد  ', price: '1500', segments: [[{ latitude: 33.5, longitude: 36.3 }, { latitude: 33.6, longitude: 36.4 }]], stops: [{ id: 'stop', name: 'موقف', coordinate: { latitude: 33.5, longitude: 36.3 } }] };
  const payload = buildPayload(draft);
  expect(payload.name_ar).toBe('خط جديد'); expect(payload.price).toBe(1500);
  expect(payload.geojson.features[0]?.geometry.coordinates).toEqual([[36.3, 33.5], [36.4, 33.6]]);
  expect(payload.geojson.features[1]?.geometry.coordinates).toEqual([36.3, 33.5]);
  expect(() => buildPayload({ ...draft, price: '12.5' })).toThrow();
  expect(() => buildPayload({ ...draft, segments: [[draft.segments[0]![0]!]] })).toThrow();
});
test('undoing a drawing operation preserves metadata typed after that operation', () => {
  const before = { ...emptyDraft('city'), segments: [[{ latitude: 33, longitude: 36 }, { latitude: 34, longitude: 37 }]] };
  const after = { ...before, nameAr: 'اسم أدخل بعد الرسم', price: '1500', segments: [[...before.segments[0]!, { latitude: 35, longitude: 38 }]] };
  const restored = restoreGeometry(after, before);
  expect(restored.segments[0]).toHaveLength(2); expect(restored.nameAr).toBe(after.nameAr); expect(restored.price).toBe('1500');
});
test('the first route can be contributed to an active zero-route city, with staff scope preserved', () => {
  const cities = decodeCities([{ id: 'new-city', nameAr: 'مدينة', nameEn: 'City', status: 'active', routeCount: 0, center: [36, 34], mapGroup: ['new-city'] }]);
  expect(cities[0]?.comingSoon).toBe(true);
  expect(studioCities(cities, [], [])).toHaveLength(1);
  expect(studioCities(cities, ['transit.edit_routes'], [])).toHaveLength(0);
  expect(studioCities(cities, ['transit.edit_routes'], ['new-city'])).toHaveLength(1);
});
test('loading a published multipart route keeps its disconnected segments and linked identity', () => {
  const draft = decodeStudioDraft({ id: 'route-id', route_id: 'route-id', is_published_route: true, city_id: 'damascus', name_ar: 'خط', name_en: null, price: 5, notes: null, geojson: JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: { colorIndex: 3 }, geometry: { type: 'MultiLineString', coordinates: [[[36.1, 33.1], [36.2, 33.2]], [[36.5, 33.5], [36.6, 33.6]]] } }, { type: 'Feature', properties: { nameAr: 'موقف' }, geometry: { type: 'Point', coordinates: [[36.1, 33.1]] } }] }) });
  expect(draft.segments).toHaveLength(2); expect(draft.editingRouteId).toBe('route-id'); expect(draft.editingDraftId).toBeNull();
  expect(buildPayload(draft).geojson.features[0]?.geometry.type).toBe('MultiLineString');
  expect(draft.stops[0]?.coordinate).toEqual({ latitude: 33.1, longitude: 36.1 });
});
test('stop snapping follows the closest real segment and vertex edits resnap stops immutably', () => {
  const line = [[{ latitude: 33, longitude: 36 }, { latitude: 33, longitude: 37 }]];
  expect(nearestOnRoute(line, { latitude: 33.3, longitude: 36.5 }).coordinate).toEqual({ latitude: 33, longitude: 36.5 });
  const draft = { ...emptyDraft('city'), segments: line, stops: [{ id: 's', name: '', coordinate: { latitude: 33, longitude: 36.5 } }] };
  const next = replaceVertex(draft, 0, 1, { latitude: 34, longitude: 37 });
  expect(next.stops[0]?.coordinate.latitude).toBeGreaterThan(33); expect(draft.stops[0]?.coordinate.latitude).toBe(33);
});
test('the source conflict warning uses intersected bounding-box area and ignores degenerate drawn area', () => {
  const line = [{ latitude: 33, longitude: 36 }, { latitude: 34, longitude: 37 }];
  expect(overlapsRoute([line], [line])).toBe(true);
  expect(overlapsRoute([[line[0]!, { latitude: 33, longitude: 37 }]], [line])).toBe(false);
});
