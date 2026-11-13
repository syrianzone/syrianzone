import { useCallback, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { useMap } from '@/Components/map/MapContext'
import { useMapLayer } from '@/Components/map/useMapLayer'
import { useMapColors } from '@/Components/map/mapColors'
import { TRANSIT_MAP_COLORS } from '../../_lib/mapColors'
import { useUserLocation } from './MapCanvas'

interface Coords {
  lng: number
  lat: number
}

function locationCollection(location: Coords | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: location
      ? [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
            properties: {},
          },
        ]
      : [],
  }
}

export default function UserLocationLayer() {
  const map = useMap()
  const colors = useMapColors(TRANSIT_MAP_COLORS)
  const location = useUserLocation()
  const locationRef = useRef(location)
  locationRef.current = location

  // A style swap re-creates the source, so the current fix is pushed again as
  // part of the attachment instead of being lost with the old one.
  const attach = useCallback((target: maplibregl.Map) => {
    target.addSource('user-location', {
      type: 'geojson',
      data: locationCollection(locationRef.current),
    })

    target.addLayer({
      id: 'user-location-radius',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 18, 20],
        'circle-color': colors.userLocationHalo,
        'circle-stroke-width': 0,
      },
    })

    target.addLayer({
      id: 'user-location-dot',
      type: 'circle',
      source: 'user-location',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 18, 8],
        'circle-color': colors.userLocation,
        'circle-stroke-width': 2,
        'circle-stroke-color': colors.markerStroke,
      },
    })

    return () => {
      try {
        if (target.getLayer('user-location-dot')) target.removeLayer('user-location-dot')
        if (target.getLayer('user-location-radius')) target.removeLayer('user-location-radius')
        if (target.getSource('user-location')) target.removeSource('user-location')
      } catch { /* map may have been removed already */ }
    }
  }, [colors])

  useMapLayer(attach)

  useEffect(() => {
    if (!map) return

    const source = map.getSource('user-location') as maplibregl.GeoJSONSource | undefined
    source?.setData(locationCollection(location))
  }, [map, location])

  return null
}
