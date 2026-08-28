import { useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapContext } from './MapContext';
import { resolveBasemapStyle } from './resolveStyle';
import './useRTLPlugin'; // side-effect: registers RTL plugin URL

export interface MapCanvasProps {
  children: ReactNode;
  center?: [number, number];
  zoom?: number;
  bounds?: maplibregl.LngLatBoundsLike;
  fitBounds?: { bounds: maplibregl.LngLatBoundsLike; padding?: number };
  maxBounds?: maplibregl.LngLatBoundsLike;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}

export function MapCanvas({
  children,
  center,
  zoom,
  bounds,
  fitBounds,
  maxBounds,
  minZoom,
  maxZoom,
  className,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [styleVersion, setStyleVersion] = useState(0);
  const styleRef = useRef('');

  // Capture initial values in refs so they don't become effect deps.
  // center/zoom/bounds are init-only: changing them after mount has no effect
  // (use map.flyTo / map.fitBounds for programmatic moves instead).
  const initRef = useRef({ center, zoom, bounds, fitBounds, maxBounds, minZoom, maxZoom });

  // Empty deps: map is created once on mount and torn down on unmount only.
  // Never put center/zoom/bounds here — they're new object references every
  // render and would cause the map to be destroyed and recreated each time.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const { center: initCenter, zoom: initZoom, bounds: initBounds, fitBounds: initFitBounds, maxBounds: initMaxBounds, minZoom: initMinZoom, maxZoom: initMaxZoom } = initRef.current;

    styleRef.current = resolveBasemapStyle();
    const mapOptions: maplibregl.MapOptions = {
      container: containerRef.current,
      style: styleRef.current,
      center: initCenter ?? [38.0, 35.0],
      zoom: initZoom ?? 6.2,
      attributionControl: false,
      fadeDuration: 0,
      maxTileCacheSize: 50,
    };
    if (initBounds) {
      mapOptions.bounds = initBounds;
      mapOptions.fitBoundsOptions = { padding: 60 };
    }
    if (initMaxBounds) mapOptions.maxBounds = initMaxBounds;
    if (initMinZoom !== undefined) mapOptions.minZoom = initMinZoom;
    if (initMaxZoom !== undefined) mapOptions.maxZoom = initMaxZoom;

    const mapInstance = new maplibregl.Map(mapOptions);

    mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapInstance.addControl(new maplibregl.NavigationControl(), 'bottom-left');

    if (initFitBounds) {
      mapInstance.fitBounds(initFitBounds.bounds, { padding: initFitBounds.padding ?? 60 });
    }

    mapInstance.on('load', () => {
      setMap(mapInstance);
    });

    const observer = new MutationObserver(() => {
      const url = resolveBasemapStyle();
      if (url !== styleRef.current) {
        styleRef.current = url;
        mapInstance.setStyle(url);
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    observerRef.current = observer;

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
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <MapContext.Provider value={{ map, styleVersion }}>
        {map ? children : null}
      </MapContext.Provider>
    </div>
  );
}
