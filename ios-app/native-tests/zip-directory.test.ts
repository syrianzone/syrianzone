import { expect, test } from 'bun:test';
import { zipEntryPaths } from './zip-directory';
test('fixture inspection decodes nested Unicode ZIP names and rejects truncated central directories', () => {
  const name = new TextEncoder().encode('backup/مسار/نص.txt'),
    bytes = new Uint8Array(46 + name.length + 22),
    view = new DataView(bytes.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(28, name.length, true);
  bytes.set(name, 46);
  const end = 46 + name.length;
  view.setUint32(end, 0x06054b50, true);
  view.setUint16(end + 10, 1, true);
  expect(zipEntryPaths(bytes)).toEqual(['backup/مسار/نص.txt']);
  expect(() => zipEntryPaths(bytes.subarray(0, -5))).toThrow();
  view.setUint16(28, 60_000, true);
  expect(() => zipEntryPaths(bytes)).toThrow();
});
