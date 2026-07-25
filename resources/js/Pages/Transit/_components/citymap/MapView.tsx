'use client'

import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import MapCanvas from './MapCanvas'
import { useMap } from '@/Components/map/MapContext'
import RouteLayer from './RouteLayer'
import StopsLayer from './StopsLayer'
import UserLocationLayer from './UserLocationLayer'
import GlobalSearchBox from './GlobalSearchBox'
import NearbyTransitDrawer from './NearbyTransitDrawer'
import type { FeatureCollection, RouteProperties, StopProperties } from '../../_types'

interface MapViewProps {
  cityId: string
  bounds: [[number, number], [number, number]]
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
  fitToData?: boolean
}

function FitToRoutes({ routes, enabled }: { routes: FeatureCollection<RouteProperties>; enabled: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !enabled) return
    if (!routes.features.length) return

    const fit = () => {
      if (!map.loaded()) return

      const bounds = new maplibregl.LngLatBounds()
      let hasCoord = false
      for (const f of routes.features) {
        const geom = f.geometry
        if (geom.type === 'LineString') {
          for (const c of geom.coordinates) {
            bounds.extend(c as [number, number])
            hasCoord = true
          }
        } else if (geom.type === 'Point') {
          bounds.extend(geom.coordinates as [number, number])
          hasCoord = true
        }
      }

      if (!hasCoord) return

      const b = bounds.toArray()
      const [[minLng, minLat], [maxLng, maxLat]] = b
      const lngSpan = Math.abs(maxLng - minLng)
      const latSpan = Math.abs(maxLat - minLat)

      // Degenerate / tiny bounds (e.g. a stub route with 2 near-identical points)
      // make fitBounds invalid — fall back to a fixed zoom centered on the geometry.
      if (lngSpan < 0.001 && latSpan < 0.001) {
        const center = bounds.getCenter()
        map.flyTo({ center, zoom: 14, duration: 600 })
      } else {
        map.fitBounds(bounds, { padding: 80, duration: 600, maxZoom: 16 })
      }
    }

    if (map.loaded()) {
      fit()
    } else {
      map.once('idle', fit)
      map.once('load', fit)
    }
  }, [map, routes, enabled])

  return null
}

export default function MapView({ cityId, bounds, routes, stops, fitToData }: MapViewProps) {
  return (
    <MapCanvas bounds={bounds}>
      <GlobalSearchBox cityId={cityId} />
      <RouteLayer data={routes} />
      <StopsLayer data={stops} />
      <UserLocationLayer />
      <NearbyTransitDrawer />
      <FitToRoutes routes={routes} enabled={!!fitToData} />
    </MapCanvas>
  )
}
