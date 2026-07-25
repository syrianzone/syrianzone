import { useEffect, useRef } from 'react';
import { useMap } from './MapContext';

export function FlyTo(props: { lng: number; lat: number; zoom?: number; key: number }) {
  const map = useMap();
  const prevKey = useRef(props.key);

  useEffect(() => {
    if (props.key === prevKey.current) return;
    prevKey.current = props.key;
    map.flyTo({ center: [props.lng, props.lat], zoom: props.zoom ?? 15 });
  }, [props.key, props.lng, props.lat, props.zoom, map]);

  return null;
}
