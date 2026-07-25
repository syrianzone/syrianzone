import { useEffect, useRef } from 'react';
import { useMap } from './MapContext';

export function FlyTo(props: { lng: number; lat: number; zoom?: number; trigger: number }) {
  const map = useMap();
  const prevTrigger = useRef(-1);

  useEffect(() => {
    if (props.trigger === prevTrigger.current) return;
    prevTrigger.current = props.trigger;
    map.flyTo({ center: [props.lng, props.lat], zoom: props.zoom ?? 15 });
  }, [props.trigger, props.lng, props.lat, props.zoom, map]);

  return null;
}
