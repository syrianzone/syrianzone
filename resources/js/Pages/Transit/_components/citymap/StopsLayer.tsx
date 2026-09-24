'use client'

import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap, useStyleVersion } from '@/Components/map/MapContext'
import { useMapStore } from '../../_store/useMapStore'
import { firstSymbolLayerId } from './RouteLayer'
import type { FeatureCollection, StopProperties } from '../../_types'

interface StopsLayerProps {
  data: FeatureCollection<StopProperties>
}

// Escape user/dataset-sourced strings before interpolating into popup HTML
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function StopsLayer({ data }: StopsLayerProps) {
  const map = useMap()
  const styleVersion = useStyleVersion()
  const showStops = useMapStore(s => s.showStops)
  const selectedRouteId = useMapStore(s => s.selectedRouteId)

  const showStopsRef = useRef(showStops)
  showStopsRef.current = showStops
  const selectedRouteIdRef = useRef(selectedRouteId)
  selectedRouteIdRef.current = selectedRouteId

  // A re-add (style swap / new data identity) restores a visible, unfiltered
  // layer, so both pieces of state must be re-applied at creation time.
  const applyStopsState = useCallback((target: maplibregl.Map, visible: boolean, routeId: string | null) => {
    if (!target.getLayer('stops-circle')) return
    target.setLayoutProperty('stops-circle', 'visibility', visible ? 'visible' : 'none')
    target.setFilter('stops-circle', routeId ? ['in', routeId, ['get', 'routeIds']] : null)
  }, [])

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
    }, firstSymbolLayerId(map))

    applyStopsState(map, showStopsRef.current, selectedRouteIdRef.current)

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
            `<span class="inline-block px-2 py-1 text-xs font-semibold bg-[var(--pomegranate)] text-white rounded">مسار ${escapeHtml(id)}</span>`
          ).join('')
        : '<span class="text-xs" style="opacity: 0.65;">لا توجد مسارات</span>'

      // Text inherits the themed popup color (transit.css); never hardcode a
      // light/dark color here or it becomes unreadable in the other theme.
      const html = `
        <div class="p-2" dir="rtl">
          <h3 class="font-bold text-lg mb-2">${escapeHtml(props.nameAr)}</h3>
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
    };
    // styleVersion: re-add layers after a basemap style swap (setStyle wipes them)
  }, [map, data, styleVersion, applyStopsState])

  // Keep visibility + selected-route filtering in sync with the store
  useEffect(() => {
    if (!map) return
    applyStopsState(map, showStops, selectedRouteId)
  }, [map, showStops, selectedRouteId, applyStopsState])

  return null
}