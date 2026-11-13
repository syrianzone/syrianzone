import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap, useStyleVersion } from '@/Components/map/MapContext'
import { useMapColors } from '@/Components/map/mapColors'
import { TRANSIT_MAP_COLORS } from '../../_lib/mapColors'
import { useUserLocation } from './MapCanvas'

export default function UserLocationLayer() {
  const map = useMap()
  const styleVersion = useStyleVersion()
  const colors = useMapColors(TRANSIT_MAP_COLORS)
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
          'circle-color': colors.userLocationHalo,
          'circle-stroke-width': 0,
        },
      })

      map.addLayer({
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
    }

    return () => {
      try {
        if (map.getLayer('user-location-dot')) map.removeLayer('user-location-dot')
        if (map.getLayer('user-location-radius')) map.removeLayer('user-location-radius')
        if (map.getSource('user-location')) map.removeSource('user-location')
      } catch { /* map may have been removed already */ }
    }
    // styleVersion: re-add layers after a basemap style swap (setStyle wipes them)
  }, [map, styleVersion, colors])

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
    // styleVersion: the setup effect above recreates an EMPTY source after a
    // basemap style swap, so the current position has to be pushed again.
  }, [map, location, styleVersion])

  return null
}
