import { useEffect, useRef } from 'react';
import { useMap } from '@/Components/map/MapContext';
import { PLACES_LAYERS } from './PlacesLayer';
import { HOTELS_LAYERS } from './HotelsLayer';

const ALL_PIN_LAYERS = [...PLACES_LAYERS, ...HOTELS_LAYERS];

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

    for (const layer of ['clusters', 'place-pin', 'hotel-clusters', 'hotel-pin']) {
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
