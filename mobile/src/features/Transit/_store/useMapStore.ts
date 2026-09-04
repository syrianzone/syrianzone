import { create } from 'zustand';

export interface MapFocus {
  center: [number, number];
  zoom: number;
}

interface MapState {
  focus: MapFocus | null;
  focusMap: (center: [number, number], zoom: number) => void;
  hoveredStopId: string | null;
  mapBounds: [[number, number], [number, number]] | null;
  resetMap: () => void;
  selectRoute: (id: string | null) => void;
  selectStop: (id: string | null) => void;
  selectedRouteId: string | null;
  setMapBounds: (
    bounds: [[number, number], [number, number]] | null,
  ) => void;
}

const emptyMap = { focus: null, hoveredStopId: null, selectedRouteId: null };

export const useMapStore = create<MapState>((set) => ({
  focus: null,
  // Search and the locate button sit outside the map tree, so the camera target
  // travels through the store instead of a map ref.
  focusMap: (center, zoom) => set({ focus: { center, zoom } }),
  hoveredStopId: null,
  mapBounds: null,
  // A pressed map, and a map left behind, drop the selection and camera target.
  resetMap: () => set(emptyMap),
  // Only one map object is inspected at a time so a single card is on screen.
  selectRoute: (selectedRouteId) => set({ hoveredStopId: null, selectedRouteId }),
  selectStop: (hoveredStopId) => set({ hoveredStopId, selectedRouteId: null }),
  selectedRouteId: null,
  setMapBounds: (mapBounds) => set({ mapBounds }),
}));

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_store/useMapStore.ts (19 lines)
  confidence: high
  todos:      0
  notes:      Native layers consume the same focused route, stop, and bounds state, plus a camera focus the web map drives through map.flyTo.
*/
