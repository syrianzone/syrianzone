import { useEffect } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMap, useStyleVersion } from './MapContext';

export type MapLayerAttach = (map: maplibregl.Map) => void | (() => void);

/**
 * The one way a feature layer attaches itself to a MapLibre canvas.
 *
 * `attach` runs once the map is ready and again after every basemap style
 * swap: `setStyle()` drops all runtime sources and layers, and `MapCanvas`
 * bumps `styleVersion` from `style.load` — the only event that means the new
 * style is ready (see the reasoning in `MapCanvas`). Because the bump is React
 * state, `attach` never sees a style that is still loading, so a layer needs no
 * retry of its own. `map.isStyleLoaded()` is not that signal: it also waits for
 * every tile and sprite, so a layer that consulted it skipped its own add on a
 * style swap and never retried.
 *
 * Anything a re-add resets must be restored inside `attach` — feature-state
 * selection, a filter, layer visibility, the current position — because the
 * effect that follows that piece of state runs on state change only, not when
 * the style swap drops what it applied.
 *
 * The optional return value is that attachment's cleanup (unbind its handlers,
 * remove what it added). It runs before the next attach and on unmount.
 *
 * Keep `attach` stable (`useCallback` over refs) or the layer re-attaches on
 * every render.
 */
export function useMapLayer(attach: MapLayerAttach): void {
  const map = useMap();
  const styleVersion = useStyleVersion();

  useEffect(() => {
    const cleanup = attach(map);
    return typeof cleanup === 'function' ? cleanup : undefined;
  }, [map, styleVersion, attach]);
}
