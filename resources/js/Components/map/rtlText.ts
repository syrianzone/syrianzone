import maplibregl from 'maplibre-gl';

/** The vendored Arabic shaper in `public/styles/`, shared by every map. */
const RTL_TEXT_PLUGIN_URL = '/styles/mapbox-gl-rtl-text.min.js';

let registered = false;

/**
 * Register the RTL text plugin before the first map is created. MapLibre only
 * accepts a single plugin per page, so this is idempotent and must run before
 * `new maplibregl.Map(...)` for Arabic labels to be shaped right-to-left.
 */
export function ensureRtlTextPlugin(): void {
  if (registered) return;
  registered = true;
  if (maplibregl.getRTLTextPluginStatus() !== 'unavailable') return;
  void maplibregl.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, true).catch((error: unknown) => {
    console.warn('[map] RTL text plugin failed to load', error);
  });
}
