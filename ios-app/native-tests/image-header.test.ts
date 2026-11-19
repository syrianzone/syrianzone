import { expect, test } from 'bun:test';
import { imagePixelSize } from './image-header';
test('fixture reads actual PNG and JPEG dimensions and rejects type fallback or truncated headers', () => {
  const png = Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPocDnzHwAFiAKY//tLRQAAAABJRU5ErkJggg=='),
    (character) => character.charCodeAt(0),
  );
  expect(imagePixelSize(png, 'png')).toEqual({ width: 1, height: 1 });
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 0, 40, 0, 80, 0, 0xff, 0xd9]);
  expect(imagePixelSize(jpeg, 'jpg')).toEqual({ width: 80, height: 40 });
  expect(() => imagePixelSize(png, 'jpg')).toThrow();
  expect(() => imagePixelSize(jpeg.subarray(0, 8), 'jpg')).toThrow();
});
