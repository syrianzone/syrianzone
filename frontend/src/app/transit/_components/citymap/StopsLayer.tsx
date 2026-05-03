'use client'

import { useEffect } from 'react'
import { useMap } from './MapContext'
import type { FeatureCollection, StopProperties } from '../../_types'

interface StopsLayerProps {
  data: FeatureCollection<StopProperties>
}

export default function StopsLayer({ data }: StopsLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    map.addSource('stops-source', {
      type: 'geojson',
      data: data as unknown as GeoJSON.FeatureCollection,
    })

    map.addLayer({
      id: 'stops-circle',
      type: 'circle',
      source: 'stops-source',
      paint: {
        'circle-radius': 5,
        'circle-color': '#d4956a',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
      },
    })

    return () => {
      try {
        if (map.getLayer('stops-circle')) map.removeLayer('stops-circle')
        if (map.getSource('stops-source')) map.removeSource('stops-source')
      } catch { /* map may have been removed already */ }
    }
  }, [map, data])

  return null
}
