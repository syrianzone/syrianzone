import { expect, test } from 'bun:test';
import { canonicalHttpsOrigin } from './site-origin';
import { assetUrl } from './validation';

test('binds relative images to the configured backend without changing public absolute image URLs', () => {
  expect(assetUrl('/storage/portrait.jpg', 'https://127.0.0.1:9443')).toBe('https://127.0.0.1:9443/storage/portrait.jpg');
  expect(assetUrl('https://example.test/photo.jpg', 'https://127.0.0.1:9443')).toBe('https://example.test/photo.jpg');
  expect(assetUrl('/storage/portrait.jpg')).toBe('https://syrian.zone/storage/portrait.jpg');
});
test('canonical origins refuse paths, credentials and insecure destinations', () => {
  expect(canonicalHttpsOrigin('https://SYRIAN.zone:443/')).toBe('https://syrian.zone');
  for (const value of ['http://localhost', 'https://user:password@example.test', 'https://example.test/path', 'https://example.test?query=1']) {
    expect(() => canonicalHttpsOrigin(value)).toThrow();
  }
});
