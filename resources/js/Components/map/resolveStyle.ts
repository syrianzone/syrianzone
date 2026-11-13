import type { ColorScheme } from '@/Lib/theme';

/**
 * The two locally hosted vector basemaps (`public/styles/styles/`). Every
 * MapLibre map resolves its style through this table, so a style file rename is
 * one edit and no page can go on pointing at a path that does not exist.
 */
export const BASEMAP_STYLES: Record<ColorScheme, string> = {
  light: '/styles/styles/light-vector.json',
  dark: '/styles/styles/dark-matter-vector.json',
};

export function resolveBasemapStyle(scheme: ColorScheme): string {
  return BASEMAP_STYLES[scheme];
}
