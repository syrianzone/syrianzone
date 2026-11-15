import { expect, test } from 'bun:test';
import {
  documentPart,
  exportFilename,
  safeArchivePath,
  validateArchiveEntries,
  collectArchive,
} from './document-model';
test('generic documents retain any MIME while enforcing local file identity and the source 50 MiB limit', () => {
  expect(
    documentPart({
      uri: 'file:///cache/example.zip',
      name: 'مثال.zip',
      size: 0,
      mimeType: 'application/zip',
    }),
  ).toMatchObject({ name: 'مثال.zip', type: 'application/zip' });
  expect(() => documentPart({ uri: 'https://example.com/key', name: 'x', size: 1 })).toThrow();
  expect(() => documentPart({ uri: 'file:///cache/x', name: 'x', size: 50 * 1024 * 1024 + 1 })).toThrow();
});
test('archive paths preserve nested folders without traversal, duplicate-normalization or separator escapes', () => {
  expect(safeArchivePath('tierlist/candidates/اسم.png')).toBe('tierlist/candidates/اسم.png');
  for (const path of ['../secret', '/root/file', 'a/../file', 'a\\file', 'a//file'])
    expect(() => safeArchivePath(path)).toThrow();
  expect(() => validateArchiveEntries([{ filename: 'A/x.png' }, { filename: 'a/X.png' }], 10)).toThrow();
});
test('native file exports support real asset names and extensionless documents without path injection', () => {
  for (const name of ['README', 'نسخة نهائية (2)!.pdf', 'asset.svg']) expect(exportFilename(name)).toBe(true);
  for (const name of ['..', '../file', 'a\\file', 'a\nfile', 'a:b', 'x'.repeat(256)])
    expect(exportFilename(name)).toBe(false);
});
test('opt-in partial archive records failed files and progress while atomic callers reject the first failure', async () => {
  const progress: number[] = [],
    entries = [{ filename: 'a/x.txt' }, { filename: 'b/x.txt' }];
  const port = {
    download: async (item: { filename: string }) => {
      if (item.filename.startsWith('b/')) throw new Error('offline');
      return 10;
    },
    remove: async () => {},
  };
  expect(
    await collectArchive(entries, port, {
      allowPartial: true,
      maxBytes: 100,
      onProgress: (value) => progress.push(value),
    }),
  ).toEqual({ failed: ['b/x.txt'], completed: 1, bytes: 10 });
  expect(progress).toEqual([50, 100]);
  await expect(collectArchive(entries, port, { allowPartial: false, maxBytes: 100 })).rejects.toThrow(
    'offline',
  );
});
