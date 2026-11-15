import { expect, test } from 'bun:test';
import { decodeFixturePng, verifyImageGeometry, type FixtureImage } from './verify-image-geometry';
test('actual PNG decoder preserves RGBA channels for the generated native fixture', () => {
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGPocDnzHwAFiAKY//tLRQAAAABJRU5ErkJggg==',
    'base64',
  );
  expect(decodeFixturePng(bytes)).toEqual({ width: 1, height: 1, rgba: new Uint8Array([136, 68, 204, 255]) });
});
test('geometry assertions reject letterboxes, flipped orientation and elliptical circles', () => {
  const image: FixtureImage = { width: 160, height: 80, rgba: new Uint8Array(160 * 80 * 4) };
  const fill = (x: number, y: number, value: readonly number[]): void =>
    image.rgba.set(value, (y * 160 + x) * 4);
  for (let y = 0; y < 80; y++)
    for (let x = 0; x < 160; x++)
      fill(x, y, Math.hypot(x + 0.5 - 80, y + 0.5 - 40) <= 24 ? [255, 255, 255, 255] : [0, 107, 69, 255]);
  fill(10, 8, [255, 0, 0, 255]);
  fill(10, 70, [0, 0, 255, 255]);
  expect(verifyImageGeometry(image)).toMatchObject({ circleWidth: 48, circleHeight: 48 });
  const changed = (): FixtureImage => ({ ...image, rgba: image.rgba.slice() });
  const letterbox = changed();
  letterbox.rgba[(160 + 1) * 4 + 3] = 0;
  expect(() => verifyImageGeometry(letterbox)).toThrow();
  const flipped = changed();
  flipped.rgba.set([0, 0, 255, 255], (8 * 160 + 10) * 4);
  expect(() => verifyImageGeometry(flipped)).toThrow();
  const ellipse = changed();
  for (let y = 0; y < 80; y++)
    ellipse.rgba.set(
      Math.abs(y + 0.5 - 40) <= 20 ? [255, 255, 255, 255] : [0, 107, 69, 255],
      (y * 160 + 80) * 4,
    );
  expect(() => verifyImageGeometry(ellipse)).toThrow();
});
