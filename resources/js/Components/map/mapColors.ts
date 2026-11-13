import { useMemo } from 'react';
import { readThemeColor, useColorScheme } from '@/Lib/theme';

/**
 * A MapLibre/Leaflet paint property cannot read `hsl(var(--primary))`: canvas
 * and SVG renderers need a concrete colour. A token entry names the CSS custom
 * property to read at paint time, plus the value to fall back to on the server
 * (where there is no document).
 */
export interface MapColorToken {
  variable: string;
  fallback: string;
}

/**
 * A palette entry: either a token that follows the active theme, or a literal
 * for colours that are data rather than theme (a route's own colour, a
 * choropleth band) and must not change with the theme.
 */
export type MapColorEntry = MapColorToken | string;

export type ResolvedMapColors<T extends Record<string, MapColorEntry>> = {
  [K in keyof T]: string;
};

/**
 * The semantic tokens the map palettes reference today. A feature that needs
 * another one adds a `{ variable, fallback }` entry next to its palette — the
 * fallback is what the server render and a missing custom property use.
 */
export const MAP_COLOR_TOKENS = {
  primary: { variable: '--primary', fallback: '#556a4e' },
  destructive: { variable: '--destructive', fallback: '#a83f45' },
} satisfies Record<string, MapColorToken>;

export function readMapColor(entry: MapColorEntry): string {
  if (typeof entry === 'string') return entry;
  return readThemeColor(entry.variable) ?? entry.fallback;
}

/** Resolve a palette to concrete colours for the theme the document has now. */
export function resolveMapColors<T extends Record<string, MapColorEntry>>(
  entries: T,
): ResolvedMapColors<T> {
  const resolved = {} as ResolvedMapColors<T>;
  for (const key of Object.keys(entries) as (keyof T)[]) {
    resolved[key] = readMapColor(entries[key]);
  }
  return resolved;
}

/**
 * `resolveMapColors` for render code: recomputes when the scheme changes, so a
 * layer that depends on the returned palette repaints in the new theme.
 *
 * Pass a module-level constant, not an inline object literal, or the memo is
 * worthless.
 */
export function useMapColors<T extends Record<string, MapColorEntry>>(
  entries: T,
): ResolvedMapColors<T> {
  const scheme = useColorScheme();
  return useMemo(() => resolveMapColors(entries), [entries, scheme]);
}
