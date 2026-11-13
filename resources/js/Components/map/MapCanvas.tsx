import { useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapContext } from './MapContext';
import { createBaseMap, type ControlsCorner } from './createMap';
import { resolveBasemapStyle } from './resolveStyle';
import { useMapStyle } from './useMapStyle';

export interface MapCanvasProps {
  children: ReactNode;
  center?: [number, number];
  zoom?: number;
  bounds?: maplibregl.LngLatBoundsLike;
  maxBounds?: maplibregl.LngLatBoundsLike;
  minZoom?: number;
  maxZoom?: number;
  /** Corner for the attribution + zoom controls; a feature's own floating
   *  controls belong in the opposite one. Defaults to bottom-left. */
  controls?: ControlsCorner;
  className?: string;
}

export function MapCanvas({
  children,
  center,
  zoom,
  bounds,
  maxBounds,
  minZoom,
  maxZoom,
  controls,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const styleRef = useRef('');
  const { scheme, styleUrl } = useMapStyle();
  const schemeRef = useRef(scheme);
  schemeRef.current = scheme;

  // Init-only values captured in a ref so they don't become effect deps:
  // center/zoom/bounds have no effect after mount (use map.flyTo /
  // map.fitBounds for programmatic moves instead).
  const initRef = useRef({ center, zoom, bounds, maxBounds, minZoom, maxZoom, controls });

  // Empty deps: the map is created once on mount and torn down on unmount only.
  // Never put center/zoom/bounds here — they're new object references every
  // render and would destroy and recreate the map each time.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const { center: initCenter, zoom: initZoom, bounds: initBounds, maxBounds: initMaxBounds, minZoom: initMinZoom, maxZoom: initMaxZoom, controls: initControls } = initRef.current;

    const mapInstance = createBaseMap({
      container: containerRef.current,
      scheme: schemeRef.current,
      center: initCenter,
      zoom: initZoom,
      bounds: initBounds,
      maxBounds: initMaxBounds,
      minZoom: initMinZoom,
      maxZoom: initMaxZoom,
      controls: initControls,
      fadeDuration: 0,
      maxTileCacheSize: 50,
    });
    styleRef.current = resolveBasemapStyle(schemeRef.current);

    mapInstance.on('load', () => {
      setMap(mapInstance);
    });

    // setStyle() drops every runtime source/layer; bump the version so layer
    // components depending on it re-add themselves once the new style is
    // ready. Must be style.load, NOT styledata: MapLibre fires styledata for
    // every runtime mutation too (addSource/addLayer/removeLayer/setFilter/
    // setPaintProperty all mark the style changed), so bumping there makes
    // styleVersion-keyed layer effects remove+re-add their layers in an
    // endless loop (routes/stops visibly clip in and out of view).
    mapInstance.on('style.load', () => setStyleVersion(v => v + 1));

    mapRef.current = mapInstance;

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []);

  // One style per scheme, applied to the existing instance: switching theme must
  // not throw away the map's camera, sources or selection.
  useEffect(() => {
    if (!map || !styleUrl) return;
    if (styleRef.current === styleUrl) return;
    styleRef.current = styleUrl;
    map.setStyle(styleUrl);
  }, [map, styleUrl]);

  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <MapContext.Provider value={{ map, styleVersion }}>
        {map ? children : null}
      </MapContext.Provider>
    </div>
  );
}
