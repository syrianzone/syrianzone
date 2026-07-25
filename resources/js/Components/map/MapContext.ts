import { createContext, useContext } from 'react';
import type maplibregl from 'maplibre-gl';

export const MapContext = createContext<maplibregl.Map | null>(null);

export function useMap(): maplibregl.Map {
  const map = useContext(MapContext);
  if (!map) throw new Error('useMap must be used within a MapCanvas provider');
  return map;
}
