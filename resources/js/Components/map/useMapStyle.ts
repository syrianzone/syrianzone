import { useColorScheme, type ColorScheme } from '@/Lib/theme';
import { resolveBasemapStyle } from './resolveStyle';

export interface MapStyle {
  scheme: ColorScheme;
  styleUrl: string;
}

/**
 * The basemap a MapLibre canvas should show right now, re-rendering when the
 * visitor switches theme. Maps that keep their instance across a theme change
 * compare `styleUrl` and call `map.setStyle(styleUrl)`.
 */
export function useMapStyle(): MapStyle {
  const scheme = useColorScheme();
  return { scheme, styleUrl: resolveBasemapStyle(scheme) };
}
