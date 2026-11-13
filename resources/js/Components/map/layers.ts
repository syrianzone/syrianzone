import type maplibregl from 'maplibre-gl';

/**
 * The id of the basemap's first symbol layer (street names, place labels, POIs).
 * Transit geometry is inserted beneath it so the labels stay readable on top.
 * Undefined when the style has no symbol layer yet.
 */
export function firstSymbolLayerId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!Array.isArray(layers)) return undefined;
  return layers.find((layer) => layer.type === 'symbol')?.id;
}
