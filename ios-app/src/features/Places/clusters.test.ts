import { expect, test } from 'bun:test';
import { createPinIndex, sourceZoomForViewport, nativeExpansionZoom } from './clusters';

test('MapKit span and actual viewport width determine the source tile zoom', () => {
  expect(sourceZoomForViewport(360, 512)).toBe(0);
  expect(sourceZoomForViewport(360 / 256, 512)).toBe(8);
  expect(sourceZoomForViewport(360 / 256, 256)).toBe(7);
  expect(sourceZoomForViewport(360 / 256, 1024)).toBe(9);
  expect(nativeExpansionZoom(8, 512, 512, 0)).toBeCloseTo(8, 2);
  expect(nativeExpansionZoom(8, 256, 512, 0)).toBeCloseTo(9, 2);
});
test('places and hotels retain separate cluster identities, original geometry and expansion behavior', () => {
  const pins = [{ id: 'place:1', name: 'الأول', coordinate: { latitude: 34.7, longitude: 36.6 } }, { id: 'place:2', name: 'الثاني', coordinate: { latitude: 34.7001, longitude: 36.6001 } }];
  const before = JSON.stringify(pins), places = createPinIndex('place', pins), hotels = createPinIndex('hotel', pins.map(pin => ({ ...pin, id: pin.id.replace('place:', 'hotel:') })));
  const clusters = places.query([-180, -85, 180, 85], 6);
  expect(clusters).toHaveLength(1); expect(clusters[0]?.monogram).toBe('2');
  expect(clusters[0]?.id).not.toBe(hotels.query([-180, -85, 180, 85], 6)[0]?.id);
  const expansion = places.expand(clusters[0]!.id, 512, 512);
  expect(expansion).not.toBeNull(); expect(expansion!.sourceZoom).toBe(11);
  expect(places.query([-180, -85, 180, 85], 11).map(pin => pin.id)).toEqual(['place:1', 'place:2']);
  expect(JSON.stringify(pins)).toBe(before);
});
