import { expect, test } from 'bun:test';
import { assetFolders, assetMatches, decodeAssetPage, mergeAssetPage } from './model';
test('asset cursors append unique files and folder counts/search cover only the loaded snapshot', () => {
  const file = {
    path: 'uploads/one.pdf',
    filename: 'one.pdf',
    folder: 'uploads',
    size: 5,
    last_modified: 1,
    url: 'https://example.org/one.pdf',
  };
  const first = decodeAssetPage({
    success: true,
    files: [file],
    total_size: 5,
    has_more: true,
    next_cursor: 'next',
  });
  const next = decodeAssetPage({
    success: true,
    files: [
      file,
      { ...file, path: 'downloads/دمشق.pdf', filename: 'دمشق.pdf', folder: 'downloads', size: 8 },
    ],
    total_size: 13,
    has_more: false,
    next_cursor: null,
  });
  const merged = mergeAssetPage(first, next);
  expect(merged.files).toHaveLength(2);
  expect(merged.totalSize).toBe(13);
  expect(merged.hasMore).toBe(false);
  expect(assetFolders(merged.files)).toEqual([
    { value: '', label: 'كل المجلدات (2)' },
    { value: 'downloads', label: 'downloads (1)' },
    { value: 'uploads', label: 'uploads (1)' },
  ]);
  expect(assetMatches(merged.files[1]!, 'دِمَشْق', 'downloads')).toBe(true);
  expect(assetMatches(file, '', 'downloads')).toBe(false);
  expect(() =>
    decodeAssetPage({ ...first, success: true, files: [{ ...file, path: '../escape.pdf' }] }),
  ).toThrow();
  expect(() => decodeAssetPage({ success: true, files: [], has_more: true, next_cursor: null })).toThrow();
});
