import { apiOrigin } from '@/lib/env';

interface BundledMapStyle {
  glyphs?: string;
}

export function buildMapStyle<T extends BundledMapStyle>(
  style: T,
  origin = apiOrigin,
): T {
  return {
    ...style,
    glyphs: `${origin.replace(/\/$/, '')}/fonts/map/{fontstack}/{range}.pbf`,
  };
}
