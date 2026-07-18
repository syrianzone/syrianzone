import { create } from 'zustand';

interface MapState {
  hoveredStopId: string | null;
  mapBounds: [[number, number], [number, number]] | null;
  selectedRouteId: string | null;
  setHoveredStopId: (id: string | null) => void;
  setMapBounds: (
    bounds: [[number, number], [number, number]] | null,
  ) => void;
  setSelectedRouteId: (id: string | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  hoveredStopId: null,
  mapBounds: null,
  selectedRouteId: null,
  setHoveredStopId: (hoveredStopId) => set({ hoveredStopId }),
  setMapBounds: (mapBounds) => set({ mapBounds }),
  setSelectedRouteId: (selectedRouteId) => set({ selectedRouteId }),
}));

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_store/useMapStore.ts (19 lines)
  confidence: high
  todos:      0
  notes:      Native layers consume the same focused route, stop, and bounds state.
*/
