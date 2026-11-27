import { expect, test } from 'bun:test';
import { imageUploadPart } from './upload-model';

test('preserves native file metadata and normalizes compatible image filenames', () => {
  expect(imageUploadPart({ uri: 'file:///cache/photo.jpg', fileName: 'IMG_1.HEIC', mimeType: 'image/jpeg', fileSize: 500, width: 100, height: 100 }, { maxBytes: 4096, minWidth: 64, minHeight: 64 })).toEqual({ uri: 'file:///cache/photo.jpg', name: 'IMG_1.jpg', type: 'image/jpeg' });
});
test('rejects remote uploads, unsupported bytes, excessive size and undersized avatars', () => {
  const source = { uri: 'file:///cache/a.png', fileSize: 10, mimeType: 'image/png', width: 100, height: 100 };
  for (const patch of [{ uri: 'https://example.com/a.png' }, { fileSize: 5000 }, { mimeType: 'image/svg+xml' }, { width: 20 }]) expect(() => imageUploadPart({ ...source, ...patch }, { maxBytes: 4096, minWidth: 64 })).toThrow();
});
