import { expect, test } from 'bun:test';
import { cameraForCoordinates, directionsUrl } from './map-data';

test('frames Syrian coordinates without reversing longitude and latitude', () => {
  const camera = cameraForCoordinates([{ latitude: 33.5, longitude: 36.2 }, { latitude: 33.6, longitude: 36.4 }]);
  if (!camera) throw new Error('expected a camera for valid points');
  expect(camera.coordinates).toEqual({ latitude: 33.55, longitude: 36.3 });
  expect(camera.zoom).toBeGreaterThan(7);
  expect(camera.zoom).toBeLessThan(15);
});

test('rejects an empty or invalid camera rather than inventing a location', () => {
  expect(cameraForCoordinates([])).toBeNull();
  expect(() => directionsUrl({ latitude: 99, longitude: 20 }, 'مكان')).toThrow();
});

test('encodes the destination label into the native maps URL', () => {
  const url = new URL(directionsUrl({ latitude: 33.5, longitude: 36.2 }, 'سوق & باب'));
  expect(url.host).toBe('maps.apple.com');
  expect(url.searchParams.get('daddr')).toBe('33.5,36.2');
  expect(url.searchParams.get('q')).toBe('سوق & باب');
});
