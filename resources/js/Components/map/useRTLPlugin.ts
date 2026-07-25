import maplibregl from 'maplibre-gl';

const PLUGIN_URL = 'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.3.0/dist/mapbox-gl-rtl-text.js';

if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
  maplibregl.setRTLTextPlugin(PLUGIN_URL, true);
}
