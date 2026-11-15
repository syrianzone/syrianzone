import { expect, test } from 'bun:test';
import { decodeHotel, decodeHotelPage, decodeHotelPins } from './model';

const hotel = { id: 4, name: 'Hotel', name_ar: 'فندق', city: 'Homs', city_ar: 'حمص', slug: 'hotel', lat: null, lng: null, star_rating: 4, now_show_rate: null, currency: 'SYP', thumb_url: null, source_url: 'https://halasyria.com/hotels/hotel' };
test('hotels without a map coordinate or current rate remain browsable', () => {
  const page = decodeHotelPage({ data: [hotel], current_page: 1, last_page: 1, total: 1 });
  expect(page.items[0]?.coordinate).toBeNull(); expect(page.items[0]?.rate).toBeNull();
  expect(page.items[0]?.nameAr).toBe('فندق');
});
test('compact hotel map data does not require list-only attribution and currency fields', () => {
  const pins = decodeHotelPins({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [36.6, 34.7] }, properties: { id: 4, name: 'Hotel', name_ar: 'فندق', type: 'hotel' } }] });
  expect(pins).toEqual([{ id: 4, name: 'فندق', coordinate: { latitude: 34.7, longitude: 36.6 } }]);
});
test('hotel detail preserves original gallery and rejects executable attribution URLs', () => {
  const detail = decodeHotel({ ...hotel, lat: 34.7, lng: 36.6, description: 'Description', description_ar: 'وصف', images: ['https://example.test/one.jpg', 'https://example.test/two.jpg'] });
  expect(detail.images).toHaveLength(2); expect(detail.descriptionAr).toBe('وصف');
  expect(() => decodeHotel({ ...hotel, source_url: 'javascript:alert(1)' })).toThrow();
});
