import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { useMap } from '@/Components/map/MapContext';
import type { LatLng } from '../_lib/types';

export function HighlightMarker(props: { point: LatLng | null }) {
  const map = useMap();
  const markerRef = useRef<maplibregl.Marker | null>(null);

  useEffect(() => {
    markerRef.current?.remove();
    markerRef.current = null;
    if (props.point) {
      markerRef.current = new maplibregl.Marker({ color: '#7d8a5c' })
        .setLngLat([props.point.lng, props.point.lat])
        .addTo(map);
    }
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
    };
  }, [props.point, map]);

  return null;
}
