import { describe, expect, it } from 'vitest';
import { BASEMAP_STYLES, resolveBasemapStyle } from './resolveStyle';

describe('basemap styles', () => {
  it('resolves one locally hosted style per scheme', () => {
    expect(resolveBasemapStyle('light')).toBe(BASEMAP_STYLES.light);
    expect(resolveBasemapStyle('dark')).toBe(BASEMAP_STYLES.dark);
    expect(BASEMAP_STYLES.light).not.toBe(BASEMAP_STYLES.dark);
  });

  it('points at the two files that exist under public/styles/styles', () => {
    expect(Object.values(BASEMAP_STYLES)).toEqual([
      '/styles/styles/light-vector.json',
      '/styles/styles/dark-matter-vector.json',
    ]);
  });
});
