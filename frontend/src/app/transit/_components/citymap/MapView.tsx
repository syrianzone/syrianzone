'use client'

import MapCanvas from './MapCanvas'
import RouteLayer from './RouteLayer'
import StopsLayer from './StopsLayer'
import UserLocationLayer from './UserLocationLayer'
import type { FeatureCollection, RouteProperties, StopProperties } from '../../_types'

interface MapViewProps {
  bounds: [[number, number], [number, number]]
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
}

export default function MapView({ bounds, routes, stops }: MapViewProps) {
  return (
    <MapCanvas bounds={bounds}>
      <RouteLayer data={routes} />
      <StopsLayer data={stops} />
      <UserLocationLayer />
    </MapCanvas>
  )
}
