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
  const styleRef = useRef('');

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    styleRef.current = resolveBasemapStyle();
    const mapOptions: maplibregl.MapOptions = {
      container: containerRef.current,
      style: styleRef.current,
      center: center ?? [38.0, 35.0],
      zoom: zoom ?? 6.2,
      attributionControl: false,
    };
    if (bounds) {
      mapOptions.bounds = bounds;
      mapOptions.fitBoundsOptions = { padding: 60 };
    }
    if (maxBounds) mapOptions.maxBounds = maxBounds;
    if (minZoom !== undefined) mapOptions.minZoom = minZoom;
    if (maxZoom !== undefined) mapOptions.maxZoom = maxZoom;

    const mapInstance = new maplibregl.Map(mapOptions);

    mapInstance.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    mapInstance.addControl(new maplibregl.NavigationControl(), 'bottom-left');

    if (fitBounds) {
      mapInstance.fitBounds(fitBounds.bounds, { padding: fitBounds.padding ?? 60 });
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

    mapRef.current = mapInstance;

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [center, zoom, bounds]);

  return (
    <div className={className}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <MapContext.Provider value={map}>
        {map ? children : null}
      </MapContext.Provider>
    </div>
  );
}
