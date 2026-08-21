import { createContext, useContext } from 'react';
import type maplibregl from 'maplibre-gl';

export interface MapContextValue {
  map: maplibregl.Map | null;
  // Bumped every time the basemap style is (re)set. setStyle() removes all
  // runtime sources/layers, so layer components must include this in their
  // effect deps to re-add themselves after a theme switch.
  styleVersion: number;
}

export const MapContext = createContext<MapContextValue>({ map: null, styleVersion: 0 });

export function useMap(): maplibregl.Map {
  const { map } = useContext(MapContext);
  if (!map) throw new Error('useMap must be used within a MapCanvas provider');
  return map;
}

export function useStyleVersion(): number {
  return useContext(MapContext).styleVersion;
}
