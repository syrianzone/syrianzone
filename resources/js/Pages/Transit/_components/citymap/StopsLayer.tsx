import { useEffect, useRef, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import { useMap } from '@/Components/map/MapContext'
import { useMapLayer } from '@/Components/map/useMapLayer'
import { useMapColors } from '@/Components/map/mapColors'
import { firstSymbolLayerId } from '@/Components/map/layers'
import { useMapStore } from '../../_store/useMapStore'
import { TRANSIT_MAP_COLORS } from '../../_lib/mapColors'
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
  const colors = useMapColors(TRANSIT_MAP_COLORS)
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

  const attach = useCallback((target: maplibregl.Map) => {
    target.addSource('stops-source', {
      type: 'geojson',
      data,
    })

    target.addLayer({
      id: 'stops-circle',
      type: 'circle',
      source: 'stops-source',
      paint: {
        'circle-radius': 5,
        'circle-color': colors.stop,
        'circle-stroke-width': 1.5,
        'circle-stroke-color': colors.markerStroke,
      },
    }, firstSymbolLayerId(target))

    applyStopsState(target, showStopsRef.current, selectedRouteIdRef.current)

    // Hover effect
    const onEnter = () => {
      target.getCanvas().style.cursor = 'pointer'
    }

    const onLeave = () => {
      target.getCanvas().style.cursor = ''
    }

    // Click popup
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
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
        .addTo(target)
    }

    target.on('mouseenter', 'stops-circle', onEnter)
    target.on('mouseleave', 'stops-circle', onLeave)
    target.on('click', 'stops-circle', onClick)

    return () => {
      target.off('mouseenter', 'stops-circle', onEnter)
      target.off('mouseleave', 'stops-circle', onLeave)
      target.off('click', 'stops-circle', onClick)
      try {
        if (target.getLayer('stops-circle')) target.removeLayer('stops-circle')
        if (target.getSource('stops-source')) target.removeSource('stops-source')
      } catch { /* map may have been removed already */ }
    }
  }, [data, applyStopsState, colors])

  useMapLayer(attach)

  // Keep visibility + selected-route filtering in sync with the store
  useEffect(() => {
    if (!map) return
    applyStopsState(map, showStops, selectedRouteId)
  }, [map, showStops, selectedRouteId, applyStopsState])

  return null
}
