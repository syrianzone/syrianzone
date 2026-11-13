import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import MapCanvas from './MapCanvas'
import { useMap } from '@/Components/map/MapContext'
import { boundsArePoint, geometryPositions, positionsBounds, type Bounds } from '@/Components/map/geo'
import RouteLayer from './RouteLayer'
import StopsLayer from './StopsLayer'
import UserLocationLayer from './UserLocationLayer'
import GlobalSearchBox from './GlobalSearchBox'
import NearbyTransitDrawer from './NearbyTransitDrawer'
import { useMapStore } from '../../_store/useMapStore'
import { matchesMaxWidth } from '@/Lib/useIsMobile'
import type { FeatureCollection, RouteProperties, StopProperties } from '../../_types'

interface MapViewProps {
  cityId: string
  bounds: Bounds
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
}

/**
 * Run a camera fit as soon as the map can take it. The children of `MapCanvas`
 * mount only after `load`, which never fires twice, so waiting for it again
 * would wait forever; `idle` is the repeatable signal that the tiles are in and
 * `map.loaded()` is what the fit itself needs.
 */
function fitWhenLoaded(map: maplibregl.Map, fit: () => void): () => void {
  if (map.loaded()) {
    fit()
    return () => {}
  }
  map.once('idle', fit)
  return () => map.off('idle', fit)
}

function FitToCity({ bounds }: { bounds: Bounds }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const isMobile = matchesMaxWidth('md')
    const fit = () => {
      if (!map.loaded()) return
      map.fitBounds(bounds, {
        padding: { top: 40, bottom: isMobile ? 260 : 40, left: 40, right: 40 },
        duration: 0
      })
    }

    return fitWhenLoaded(map, fit)
  }, [map, bounds])

  return null
}

function FitToSelectedRoute({ routes }: { routes: FeatureCollection<RouteProperties> }) {
  const map = useMap()
  const { selectedRouteId } = useMapStore()

  useEffect(() => {
    if (!map || !selectedRouteId) return

    const feature = routes.features.find(f => f.properties?.id === selectedRouteId)
    if (!feature) return

    const isMobile = matchesMaxWidth('md')

    const fit = () => {
      if (!map.loaded()) return

      const extent = positionsBounds(geometryPositions(feature.geometry))
      if (!extent) return

      if (boundsArePoint(extent)) {
        const [[west, south], [east, north]] = extent
        map.flyTo({ center: [(west + east) / 2, (south + north) / 2], zoom: 14, duration: 600 })
      } else {
        map.fitBounds(extent, {
          padding: { top: 80, bottom: isMobile ? 270 : 80, left: 60, right: 60 },
          duration: 600,
          maxZoom: 16
        })
      }
    }

    return fitWhenLoaded(map, fit)
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
