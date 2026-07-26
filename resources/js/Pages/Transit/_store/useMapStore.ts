import { create } from 'zustand'

interface MapState {
  selectedRouteId: string | null
  hoveredStopId: string | null
  mapBounds: [[number, number], [number, number]] | null
  showStops: boolean
  setSelectedRouteId: (id: string | null) => void
  setHoveredStopId: (id: string | null) => void
  setMapBounds: (bounds: [[number, number], [number, number]] | null) => void
  setShowStops: (show: boolean) => void
}

export const useMapStore = create<MapState>((set) => ({
  selectedRouteId: null,
  hoveredStopId: null,
  mapBounds: null,
  showStops: true,
  setSelectedRouteId: (id) => set({ selectedRouteId: id }),
  setHoveredStopId: (id) => set({ hoveredStopId: id }),
  setMapBounds: (bounds) => set({ mapBounds: bounds }),
  setShowStops: (show) => set({ showStops: show }),
}))