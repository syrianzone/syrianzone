'use client'

import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from './MapContext'
import { useUserLocation } from './MapCanvas'

export default function UserLocationLayer() {
  const map = useMap()
  const location = useUserLocation()

  useEffect(() => {
    if (!map) return

    if (!map.getSource('user-location')) {
      map.addSource('user-location', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })

      map.addLayer({
        id: 'user-location-radius',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 10, 18, 20],
          'circle-color': 'rgba(74, 143, 168, 0.15)',
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
        id: 'user-location-dot',
        type: 'circle',
        source: 'user-location',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 18, 8],
          'circle-color': '#4a8fa8',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
    }

    return () => {
      try {
        if (map.getLayer('user-location-dot')) map.removeLayer('user-location-dot')
        if (map.getLayer('user-location-radius')) map.removeLayer('user-location-radius')
        if (map.getSource('user-location')) map.removeSource('user-location')
      } catch { /* map may have been removed already */ }
    }
  }, [map])

  useEffect(() => {
    if (!map || !location) return

    const source = map.getSource('user-location') as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [location.lng, location.lat],
            },
            properties: {},
          },
        ],
      })
    }
  }, [map, location])

  return null
}
