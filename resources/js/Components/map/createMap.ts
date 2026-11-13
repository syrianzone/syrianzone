import maplibregl from 'maplibre-gl';
import type { ColorScheme } from '@/Lib/theme';
import { resolveBasemapStyle } from './resolveStyle';
import { ensureRtlTextPlugin } from './rtlText';

export type ControlsCorner = 'bottom-left' | 'bottom-right';

export interface BaseMapOptions {
  container: HTMLElement;
  scheme: ColorScheme;
  center?: [number, number];
  zoom?: number;
  bounds?: maplibregl.LngLatBoundsLike;
  boundsPadding?: number;
  maxBounds?: maplibregl.LngLatBoundsLike;
  minZoom?: number;
  maxZoom?: number;
  /** Corner for the attribution, zoom (and optional locate) controls. */
  controls?: ControlsCorner;
  geolocate?: boolean;
  doubleClickZoom?: boolean;
  fadeDuration?: number;
  maxTileCacheSize?: number;
}

/** Attribution + zoom (`+ locate`, when asked) in one corner, as every map has them. */
function addStandardControls(
  map: maplibregl.Map,
  corner: ControlsCorner,
  geolocate = false,
): void {
  map.addControl(new maplibregl.AttributionControl({ compact: true }), corner);
  map.addControl(new maplibregl.NavigationControl(), corner);
  if (geolocate) {
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      corner,
    );
  }
}

/**
 * The MapLibre canvas every feature starts from: RTL plugin registered, the
 * scheme's basemap style, no attribution control duplicated (ours is compact
 * and placed with the zoom buttons), and the standard controls.
 *
 * The style is resolved once, here. A map that must follow a theme change keeps
 * its instance and calls `map.setStyle(resolveBasemapStyle(scheme))` — see
 * `useMapStyle`.
 */
export function createBaseMap(options: BaseMapOptions): maplibregl.Map {
  ensureRtlTextPlugin();

  const mapOptions: maplibregl.MapOptions = {
    container: options.container,
    style: resolveBasemapStyle(options.scheme),
    center: options.center ?? [38.0, 35.0],
    zoom: options.zoom ?? 6.2,
    attributionControl: false,
  };
  // Only override MapLibre's own defaults when the caller asks: the canvas wants
  // instant tile swaps and a small cache, the editing maps do not.
  if (options.fadeDuration !== undefined) mapOptions.fadeDuration = options.fadeDuration;
  if (options.maxTileCacheSize !== undefined) mapOptions.maxTileCacheSize = options.maxTileCacheSize;
  if (options.bounds) {
    mapOptions.bounds = options.bounds;
    mapOptions.fitBoundsOptions = { padding: options.boundsPadding ?? 60 };
  }
  if (options.maxBounds) mapOptions.maxBounds = options.maxBounds;
  if (options.minZoom !== undefined) mapOptions.minZoom = options.minZoom;
  if (options.maxZoom !== undefined) mapOptions.maxZoom = options.maxZoom;
  if (options.doubleClickZoom !== undefined) mapOptions.doubleClickZoom = options.doubleClickZoom;

  const map = new maplibregl.Map(mapOptions);
  addStandardControls(map, options.controls ?? 'bottom-left', options.geolocate ?? false);
  return map;
}
