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
import { useMapStore } from '../../_store/useMapStore'
import type { FeatureCollection, RouteProperties, StopProperties } from '../../_types'

interface MapViewProps {
  cityId: string
  bounds: [[number, number], [number, number]]
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
}

function FitToCity({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const fit = () => {
      if (!map.loaded()) return
      map.fitBounds(bounds, { padding: 40, duration: 0 })
    }

    if (map.loaded()) {
      fit()
    } else {
      map.once('idle', fit)
      map.once('load', fit)
    }
  }, [map, bounds])

  return null
}

function FitToSelectedRoute({ routes }: { routes: FeatureCollection<RouteProperties> }) {
  const map = useMap()
  const { selectedRouteId } = useMapStore()

  useEffect(() => {
    if (!map || !selectedRouteId) return

    const feature = routes.features.find(f => f.properties.id === selectedRouteId)
    if (!feature) return

    const fit = () => {
      if (!map.loaded()) return

      const geom = feature.geometry
      if (geom.type !== 'LineString' && geom.type !== 'Point') return

      const b = new maplibregl.LngLatBounds()
      if (geom.type === 'LineString') {
        for (const c of geom.coordinates) {
          b.extend(c as [number, number])
        }
      } else {
        b.extend(geom.coordinates as [number, number])
      }

      const corners = b.toArray()
      const [[minLng, minLat], [maxLng, maxLat]] = corners
      const lngSpan = Math.abs(maxLng - minLng)
      const latSpan = Math.abs(maxLat - minLat)

      if (lngSpan < 0.001 && latSpan < 0.001) {
        const center = b.getCenter()
        map.flyTo({ center, zoom: 14, duration: 600 })
      } else {
        map.fitBounds(b, { padding: 80, duration: 600, maxZoom: 16 })
      }
    }

    if (map.loaded()) {
      fit()
    } else {
      map.once('idle', fit)
      map.once('load', fit)
    }
  }, [map, selectedRouteId, routes])

  return null
}

export default function MapView({ cityId, bounds, routes, stops }: MapViewProps) {
  return (
    <MapCanvas bounds={bounds}>
      <GlobalSearchBox cityId={cityId} />
      <RouteLayer data={routes} />
      <StopsLayer data={stops} />
      <UserLocationLayer />
      <NearbyTransitDrawer />
      <FitToCity bounds={bounds} />
      <FitToSelectedRoute routes={routes} />
    </MapCanvas>
  )
}
