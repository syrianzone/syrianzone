'use client'

import MapCanvas from './MapCanvas'
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
}

export default function MapView({ cityId, bounds, routes, stops }: MapViewProps) {
  return (
    <MapCanvas bounds={bounds}>
      <GlobalSearchBox cityId={cityId} />
      <RouteLayer data={routes} />
      <StopsLayer data={stops} />
      <UserLocationLayer />
      <NearbyTransitDrawer />
    </MapCanvas>
  )
}
