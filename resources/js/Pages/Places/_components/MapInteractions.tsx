import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import { useMap } from '@/Components/map/MapContext';
import { HOTEL_PIN_LAYERS, PLACE_PINS, HOTEL_PINS, PLACE_PIN_LAYERS } from './PinLayer';

const ALL_PIN_LAYERS = [...PLACE_PIN_LAYERS, ...HOTEL_PIN_LAYERS];
const CLICKABLE_LAYERS = [
  PLACE_PINS.clusterLayerId,
  PLACE_PINS.pinLayerId,
  HOTEL_PINS.clusterLayerId,
  HOTEL_PINS.pinLayerId,
];

/** The pin layers currently in the style: a theme switch drops them until re-added. */
function presentLayers(map: maplibregl.Map, layers: string[]): string[] {
  return layers.filter((layer) => map.getLayer(layer));
}

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
    // Querying a layer that is not in the style throws, so a click on the map
    // during a style swap must ask only about the layers that exist; the pins
    // re-add themselves and are queried again from then on.
    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const layers = presentLayers(map, ALL_PIN_LAYERS);
      const hits = layers.length > 0 ? map.queryRenderedFeatures(e.point, { layers }) : [];
      if (hits.length > 0) return;
      onMapClickRef.current({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    map.on('click', onMapClick);

    const bound: Array<{ event: 'mouseenter' | 'mouseleave'; layer: string; handler: () => void }> = [];
    for (const layer of CLICKABLE_LAYERS) {
      // `addMode` already owns the crosshair cursor, so a pin only changes it
      // while a click means "select this".
      const enter = () => {
        if (!addModeRef.current) map.getCanvas().style.cursor = 'pointer';
      };
      const leave = () => {
        if (!addModeRef.current) map.getCanvas().style.cursor = '';
      };
      map.on('mouseenter', layer, enter);
      map.on('mouseleave', layer, leave);
      bound.push(
        { event: 'mouseenter', layer, handler: enter },
        { event: 'mouseleave', layer, handler: leave },
      );
    }

    return () => {
      map.off('click', onMapClick);
      for (const { event, layer, handler } of bound) map.off(event, layer, handler);
      map.getCanvas().style.cursor = '';
    };
  }, [map]);

  useEffect(() => {
    map.getCanvas().style.cursor = props.addMode ? 'crosshair' : '';
  }, [props.addMode, map]);

  return null;
}
