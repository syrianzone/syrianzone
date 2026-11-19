import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { imagePixelSize } from './image-header';

export interface FixtureImage {
  width: number;
  height: number;
  rgba: Uint8Array;
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
/** Decode bounded8bit RGB/RGBA fixture PNGs, never production/user documents. */
export function decodeFixturePng(bytes: Uint8Array): FixtureImage {
  const { width, height } = imagePixelSize(bytes, 'png'),
    view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const color = bytes[25],
    channels = color === 6 ? 4 : color === 2 ? 3 : 0;
  if (
    bytes.length > 2_000_000 ||
    width * height > 1_000_000 ||
    bytes[24] !== 8 ||
    !channels ||
    bytes[28] !== 0
  )
    throw new Error('Fixture PNG encoding outside bounded RGB/RGBA8 contract');
  const pieces: Uint8Array[] = [];
  for (let offset = 8; offset + 12 <= bytes.length; ) {
    const length = view.getUint32(offset),
      type = view.getUint32(offset + 4);
    if (offset + 12 + length > bytes.length) throw new Error('PNG chunk truncated');
    if (type === 0x49444154) pieces.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const rowBytes = width * channels,
    expected = (rowBytes + 1) * height;
  const scan = inflateSync(Buffer.concat(pieces), { maxOutputLength: expected });
  if (scan.length !== expected) throw new Error('PNG scanline length mismatch');
  const pixels = new Uint8Array(rowBytes * height),
    rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const filter = scan[y * (rowBytes + 1)];
    if (filter === undefined || filter > 4) throw new Error('Unknown PNG filter');
    for (let x = 0; x < rowBytes; x++) {
      const index = y * rowBytes + x,
        left = x >= channels ? (pixels[index - channels] ?? 0) : 0,
        up = y ? (pixels[index - rowBytes] ?? 0) : 0,
        corner = y && x >= channels ? (pixels[index - rowBytes - channels] ?? 0) : 0;
      const prediction =
        filter === 1
          ? left
          : filter === 2
            ? up
            : filter === 3
              ? Math.floor((left + up) / 2)
              : filter === 4
                ? paeth(left, up, corner)
                : 0;
      pixels[index] = ((scan[y * (rowBytes + 1) + 1 + x] ?? 0) + prediction) & 255;
    }
  }
  for (let index = 0; index < width * height; index++) {
    rgba[index * 4] = pixels[index * channels] ?? 0;
    rgba[index * 4 + 1] = pixels[index * channels + 1] ?? 0;
    rgba[index * 4 + 2] = pixels[index * channels + 2] ?? 0;
    rgba[index * 4 + 3] = channels === 4 ? (pixels[index * channels + 3] ?? 0) : 255;
  }
  return { width, height, rgba };
}
export function verifyImageGeometry(image: FixtureImage): {
  width: number;
  height: number;
  circleWidth: number;
  circleHeight: number;
} {
  if (image.width !== 160 || image.height !== 80) throw new Error('Expected160x80 exported PNG');
  const pixel = (x: number, y: number): number[] =>
    Array.from(image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4));
  const assertColor = (x: number, y: number, expected: readonly number[]): void => {
    const actual = pixel(x, y);
    if (
      actual.length !== 4 ||
      actual.some((channel, index) => Math.abs(channel - (expected[index] ?? 0)) > 2)
    )
      throw new Error(`Pixel${x},${y}: ${actual.join(',')} expected${expected.join(',')}`);
  };
  for (const [x, y] of [
    [1, 1],
    [158, 1],
    [1, 78],
    [158, 78],
  ] as const)
    assertColor(x, y, [0, 107, 69, 255]);
  assertColor(10, 8, [255, 0, 0, 255]);
  assertColor(10, 70, [0, 0, 255, 255]);
  const white = (x: number, y: number): boolean => pixel(x, y).every((channel) => channel >= 250);
  const horizontal = Array.from({ length: 160 }, (_, x) => x).filter((x) => white(x, 40)),
    vertical = Array.from({ length: 80 }, (_, y) => y).filter((y) => white(80, y));
  const circleWidth = (horizontal.at(-1) ?? 0) - (horizontal[0] ?? 0) + 1,
    circleHeight = (vertical.at(-1) ?? 0) - (vertical[0] ?? 0) + 1;
  if (
    circleWidth < 46 ||
    circleWidth > 50 ||
    circleHeight < 46 ||
    circleHeight > 50 ||
    Math.abs(circleWidth - circleHeight) > 1
  )
    throw new Error(`Circle geometry distorted:${circleWidth}x${circleHeight}`);
  return { width: image.width, height: image.height, circleWidth, circleHeight };
}
if (import.meta.main) {
  const path = process.argv[2];
  if (!path) throw new Error('Pass the actual fixture PNG path');
  console.log(JSON.stringify({ passed: true, ...verifyImageGeometry(decodeFixturePng(readFileSync(path))) }));
}
