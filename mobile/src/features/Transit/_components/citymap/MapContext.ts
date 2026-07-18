import type { MapRef } from '@maplibre/maplibre-react-native';
import { createContext, useContext } from 'react';

export const MapContext = createContext<MapRef | null>(null);

export function useMap() {
  return useContext(MapContext);
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/citymap/MapContext.ts (8 lines)
  confidence: high
  todos:      0
  notes:      The context exposes a native MapLibre map ref.
*/
