import { expect, test } from 'bun:test';
import { acceptPhotos, contributionFieldErrors, decodeFullPlace, decodePlacePins, decodePhotoPage, deviceSnapshot, parseCoordinates, validateContribution, validateDetailsPatch, validatePhoto } from './model';

const place = { id: 7, name: 'موقع', category: 'historical', description: 'وصف موثق للمكان الذي نريد زيارته', lat: 34.7, lng: 36.6, thumb_url: null, saves_count: 4, status: 'pending', user: { id: 3, name: 'مرشد', avatar_url: null, level: 4, points: 250 }, photos: [{ id: 9, thumb_url: 'https://example.test/t.webp?v=2', display_url: 'https://example.test/p.webp?v=2', sort: 0 }], saved_by_me: false, created_at: '2026-11-14T10:00:00Z' };
test('full place detail retains owner rank, moderation and account state without changing coordinates', () => {
  const value = decodeFullPlace(place);
  expect(value.coordinate).toEqual({ latitude: 34.7, longitude: 36.6 });
  expect(value.user).toMatchObject({ id: 3, level: 4, points: 250 });
  expect(value.status).toBe('pending'); expect(value.savedByMe).toBe(false);
  expect(value.photos[0]?.url).toContain('?v=2');
  expect(() => decodeFullPlace({ ...place, saved_by_me: 'false' })).toThrow();
});
test('account-independent snapshots reject unpublished places and exclude authenticated detail metadata', () => {
  const pending = decodeFullPlace(place);
  expect(() => deviceSnapshot(pending)).toThrow('غير منشور');
  expect(() => deviceSnapshot({ ...pending, status: 'rejected' })).toThrow('غير منشور');
  const snapshot = deviceSnapshot({ ...pending, status: 'approved' });
  expect(snapshot).toMatchObject({ id: 7, name: 'موقع', coordinate: { latitude: 34.7, longitude: 36.6 } });
  for (const field of ['status', 'user', 'photos', 'savedByMe']) expect(field in snapshot).toBe(false);
});
test('contribution errors identify every invalid field before upload without discarding valid input', () => {
  const input = { name: '', category: '', description: 'قصير', coordinate: { latitude: 34.7, longitude: 36.6 }, photos: [] };
  expect(Object.keys(contributionFieldErrors(input))).toEqual(['name', 'category', 'description', 'photos']);
  expect(contributionFieldErrors({ ...input, name: 'موقع', category: 'historical', coordinate: { latitude: 50, longitude: 36.6 } })).toHaveProperty('lat');
  expect(input.description).toBe('قصير');
});
test('owner patches leave unrelated fields out of the request and reject empty edits', () => {
  expect(validateDetailsPatch({ name: '  اسم جديد  ' })).toEqual({ name: 'اسم جديد' });
  expect(() => validateDetailsPatch({})).toThrow();
  expect(() => validateDetailsPatch({ description: 'قصير' })).toThrow();
});
test('all-map pins are independent of pagination and distinguish contributor identity', () => {
  const pins = decodePlacePins({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [36.6, 34.7] }, properties: { id: 7, name: 'موقع', category: 'historical', user_id: 3, thumb_url: null } }] });
  expect(pins[0]).toMatchObject({ id: 7, userId: 3, coordinate: { latitude: 34.7, longitude: 36.6 } });
  expect(() => decodePlacePins({ type: 'FeatureCollection', features: [{ geometry: { type: 'LineString', coordinates: [36.6, 34.7] }, properties: {} }] })).toThrow();
});
test('photo wall keeps parent place identity and validates the pagination envelope', () => {
  const page = decodePhotoPage({ current_page: 1, last_page: 2, total: 25, data: [{ id: 9, thumb_url: 'https://example.test/t.jpg', display_url: 'https://example.test/d.jpg', place: { id: 7, name: 'موقع', category: 'historical', lat: 34.7, lng: 36.6 } }] });
  expect(page.items[0]?.place.id).toBe(7); expect(page.lastPage).toBe(2);
  expect(() => decodePhotoPage({ current_page: 0, last_page: 1, total: 0, data: [] })).toThrow();
});
test('coordinate search preserves source hemisphere and decimal-comma ambiguity rules', () => {
  expect(parseCoordinates('36,70764° E, 34,73192° N')).toEqual({ latitude: 34.73192, longitude: 36.70764 });
  expect(parseCoordinates('34.7 S, 36.6 W')).toEqual({ latitude: -34.7, longitude: -36.6 });
  expect(parseCoordinates('34 36')).toEqual({ latitude: 34, longitude: 36 });
  for (const input of ['34,73192, 36,70764', '91, 30', '34, 190', '34.7 N, 36.6 N', '-34.7 S, 36.6 W', 'دمشق']) expect(parseCoordinates(input)).toBeNull();
});
test('contribution validation matches Syria and original media/text boundaries', () => {
  const photo = { uri: 'file:///tmp/p.jpg', name: 'p.jpg', mimeType: 'image/jpeg', size: 12 * 1024 * 1024, width: 200, height: 6000 };
  expect(validatePhoto(photo)).toEqual(photo);
  expect(validateContribution({ name: '  موقع  ', category: 'historical', description: 'وصف موثق للمكان الذي نريد زيارته', coordinate: { latitude: 34.7, longitude: 36.6 }, photos: [photo] }).name).toBe('موقع');
  for (const patch of [{ size: photo.size + 1 }, { width: 199 }, { height: 6001 }, { mimeType: 'image/heic' }]) expect(() => validatePhoto({ ...photo, ...patch })).toThrow();
  expect(() => validateContribution({ name: 'موقع', category: 'historical', description: 'قصير', coordinate: { latitude: 34.7, longitude: 36.6 }, photos: [photo] })).toThrow();
  expect(() => validateContribution({ name: 'موقع', category: 'historical', description: place.description, coordinate: { latitude: 50, longitude: 36.6 }, photos: [photo] })).toThrow();
});
test('mixed photo selections keep valid images in source order and explain rejected images without losing them', () => {
  const first = { uri: 'file:///tmp/one.jpg', name: 'one.jpg', mimeType: 'image/jpeg', size: 1024, width: 800, height: 600 };
  const second = { ...first, uri: 'file:///tmp/two.jpg', name: 'two.jpg' };
  const input = [first, { ...first, name: 'invalid.heic', mimeType: 'image/heic' }, second];
  const batch = acceptPhotos(input, 2);
  expect(batch.accepted).toEqual([first, second]); expect(batch.errors).toHaveLength(1); expect(batch.errors[0]).toContain('invalid.heic');
  expect(acceptPhotos([first, second], 1).accepted).toEqual([first]);
  expect(acceptPhotos([first, second], 1).errors).toHaveLength(1);
  expect(input).toHaveLength(3);
});
