import { createContext, useContext } from 'react'
import type maplibregl from 'maplibre-gl'

export const MapContext = createContext<maplibregl.Map | null>(null)

export function useMap() {
  return useContext(MapContext)
}
