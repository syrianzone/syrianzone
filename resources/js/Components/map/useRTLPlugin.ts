import maplibregl from 'maplibre-gl';

const PLUGIN_URL = '/styles/mapbox-gl-rtl-text.min.js';

if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
  maplibregl.setRTLTextPlugin(PLUGIN_URL, true);
}
