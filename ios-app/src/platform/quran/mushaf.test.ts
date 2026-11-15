import { expect, test } from 'bun:test';
import { pageForAyah, parseJump, readMushafPage, type QuranPage } from './mushaf';

test('bundled native Mushaf matches unchanged source page models at all 604 page boundaries', async () => {
  const originalFetch = globalThis.fetch;
  const assets: Record<string, unknown> = {
    '/quran-data/hafs-16/manifest.json': await Bun.file(new URL('../../../../public/quran-data/hafs-16/manifest.json', import.meta.url)).json(),
    '/quran-data/hafs-24/manifest.json': await Bun.file(new URL('../../../../public/quran-data/hafs-24/manifest.json', import.meta.url)).json(),
    '/quran-data/mushaf-unified.json': await Bun.file(new URL('../../../../public/quran-data/mushaf-unified.json', import.meta.url)).json()
  };
  // The source loader is exercised against the same immutable local assets, never the network.
  globalThis.fetch = (async (url: string | URL | Request) => {
    const path = String(url);
    if (!(path in assets)) throw new Error(`Unexpected source request ${path}`);
    return Response.json(assets[path]);
  }) as typeof fetch;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const source = require('../../../../resources/js/Domain/quran/quran') as { renderMushafPage(page: number, font: number): Promise<QuranPage> };
    for (let page = 1; page <= 604; page++) {
      const native = await readMushafPage(page);
      expect(native).toEqual(await source.renderMushafPage(page, 25));
      expect(native.lines).toHaveLength(15);
    }
  } finally { globalThis.fetch = originalFetch; }
});
test('native reader jump validates real Ayah counts and accepts Arabic numerals and multiword Surah names', async () => {
  expect(await pageForAyah(2, 255)).toBe(42);
  expect(await parseJump('٢:٢٥٥')).toEqual({ page: 42, ayahKey: '2:255' });
  expect(await parseJump('سورة آل عمران 1')).toEqual({ page: 50, ayahKey: '3:1' });
  expect(await parseJump('100')).toEqual({ page: 100, ayahKey: null });
  expect(await parseJump('114:7')).toBeNull();
  expect(await parseJump('0')).toEqual({ page: 1, ayahKey: null });
  expect(await parseJump('605')).toEqual({ page: 604, ayahKey: null });
});
