import { useEffect, useRef } from 'react';
import { useMap } from '@/Components/map/MapContext';
import { HOTEL_PIN_LAYERS, PLACE_PINS, HOTEL_PINS, PLACE_PIN_LAYERS } from './PinLayer';

const ALL_PIN_LAYERS = [...PLACE_PIN_LAYERS, ...HOTEL_PIN_LAYERS];
const CLICKABLE_LAYERS = [
  PLACE_PINS.clusterLayerId,
  PLACE_PINS.pinLayerId,
  HOTEL_PINS.clusterLayerId,
  HOTEL_PINS.pinLayerId,
];

export function MapInteractions(props: {
  addMode: boolean;
  onMapClick: (point: { lng: number; lat: number }) => void;
}) {
  const map = useMap();
  const addModeRef = useRef(props.addMode);
  addModeRef.current = props.addMode;
  const onMapClickRef = useRef(props.onMapClick);
  onMapClickRef.current = props.onMapClick;

  useEffect(() => {
    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ALL_PIN_LAYERS });
      if (hits.length > 0) return;
      onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    map.on('click', onMapClick);

    for (const layer of CLICKABLE_LAYERS) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = addModeRef.current ? 'crosshair' : 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = addModeRef.current ? 'crosshair' : ''; });
    }

    return () => {
      map.off('click', onMapClick);
    };
  }, [map]);

  // cursor for add-mode on empty areas
  useEffect(() => {
    map.getCanvas().style.cursor = props.addMode ? 'crosshair' : '';
  }, [props.addMode, map]);

  return null;
}
