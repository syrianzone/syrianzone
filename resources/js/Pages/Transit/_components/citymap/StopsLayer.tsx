'use client'

import { useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '@/Components/map/MapContext'
import { useMapStore } from '../../_store/useMapStore'
import type { FeatureCollection, StopProperties } from '../../_types'

interface StopsLayerProps {
  data: FeatureCollection<StopProperties>
}

export default function StopsLayer({ data }: StopsLayerProps) {
  const map = useMap()
  const showStops = useMapStore(s => s.showStops)
  const selectedRouteId = useMapStore(s => s.selectedRouteId)

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

    // Hover effect
    map.on('mouseenter', 'stops-circle', () => {
      map.getCanvas().style.cursor = 'pointer'
    })
    
    map.on('mouseleave', 'stops-circle', () => {
      map.getCanvas().style.cursor = ''
    })

    // Click popup
    map.on('click', 'stops-circle', (e) => {
      if (!e.features || e.features.length === 0) return

      const feature = e.features[0]
      const props = feature.properties as unknown as StopProperties

      // MapLibre serializes array properties as JSON strings — parse them back
      const rawRouteIds = props.routeIds
      const routeIds: string[] = Array.isArray(rawRouteIds)
        ? rawRouteIds
        : (typeof rawRouteIds === 'string' ? JSON.parse(rawRouteIds) : [])

      const badgesHtml = routeIds.length
        ? routeIds.map(id =>
            `<span class="inline-block px-2 py-1 text-xs font-semibold bg-[var(--pomegranate)] text-white rounded">مسار ${id}</span>`
          ).join('')
        : '<span class="text-xs text-gray-400">لا توجد مسارات</span>'

      const html = `
        <div class="p-2" dir="rtl">
          <h3 class="font-bold text-lg mb-2 text-[#2c3e50]">${props.nameAr}</h3>
          <div class="flex flex-wrap gap-1">
            ${badgesHtml}
          </div>
        </div>
      `

      new maplibregl.Popup({ closeButton: false })
        .setLngLat(e.lngLat)
        .setHTML(html)
        .addTo(map)
    })

    return () => {
      try {
        if (map.getLayer('stops-circle')) map.removeLayer('stops-circle')
        if (map.getSource('stops-source')) map.removeSource('stops-source')
      } catch { /* map may have been removed already */ }
    }
  }, [map, data])

  // React to showStops changes
  useEffect(() => {
    if (!map) return
    if (map.getLayer('stops-circle')) {
      map.setLayoutProperty('stops-circle', 'visibility', showStops ? 'visible' : 'none')
    }
  }, [map, showStops])

  // Hide stops not belonging to the selected route
  useEffect(() => {
    if (!map || !map.getLayer('stops-circle')) return
    if (selectedRouteId) {
      map.setFilter('stops-circle', ['in', selectedRouteId, ['get', 'routeIds']])
    } else {
      map.setFilter('stops-circle', null)
    }
  }, [map, selectedRouteId])

  return null
}