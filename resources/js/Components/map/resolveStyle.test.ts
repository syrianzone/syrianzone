import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BASEMAP_STYLES, resolveBasemapStyle } from './resolveStyle';
import type { ColorScheme } from '@/Lib/theme';

/**
 * Every MapLibre map takes its style from `resolveBasemapStyle`, so the paths in
 * that table are shipped files: a renamed or missing style file is a blank map.
 */
const publicFile = (path: string) => fileURLToPath(new URL(`../../../../public${path}`, import.meta.url));

describe('basemap styles', () => {
  it('resolves a different style per scheme', () => {
    const schemes: ColorScheme[] = ['light', 'dark'];

    for (const scheme of schemes) expect(resolveBasemapStyle(scheme), scheme).toBeTruthy();
    expect(resolveBasemapStyle('light')).not.toBe(resolveBasemapStyle('dark'));
    expect(Object.keys(BASEMAP_STYLES).sort()).toEqual([...schemes].sort());
  });

  it('points at a style file that exists under public/', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(existsSync(publicFile(resolveBasemapStyle(scheme))), resolveBasemapStyle(scheme)).toBe(true);
    }
  });
});
