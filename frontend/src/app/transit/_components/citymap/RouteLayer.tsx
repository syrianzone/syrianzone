'use client'

import { useEffect } from 'react'
import { useMap } from './MapContext'
import { getRouteColor } from '../../_lib/mapColors'
import type { FeatureCollection, RouteProperties } from '../../_types'

interface RouteLayerProps {
  data: FeatureCollection<RouteProperties>
}

/** Match expression mapping colorIndex → palette color */
function buildColorMatch(): unknown {
  return [
    'match',
    ['%', ['get', 'colorIndex'], 8],
    0, getRouteColor(0),
    1, getRouteColor(1),
    2, getRouteColor(2),
    3, getRouteColor(3),
    4, getRouteColor(4),
    5, getRouteColor(5),
    6, getRouteColor(6),
    7, getRouteColor(7),
    getRouteColor(0),
  ]
}

export default function RouteLayer({ data }: RouteLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    map.addSource('routes-source', {
      type: 'geojson',
      data: data as unknown as GeoJSON.FeatureCollection,
    })

    const colorExpr = buildColorMatch()

    map.addLayer({
      id: 'routes-line',
      type: 'line',
      source: 'routes-source',
      paint: {
        'line-width': 4,
        'line-color': colorExpr as unknown as string,
        'line-opacity': 0.85,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    })

    return () => {
      try {
        if (map.getLayer('routes-line')) map.removeLayer('routes-line')
        if (map.getSource('routes-source')) map.removeSource('routes-source')
      } catch { /* map may have been removed already */ }
    }
  }, [map, data])

  return null
}
