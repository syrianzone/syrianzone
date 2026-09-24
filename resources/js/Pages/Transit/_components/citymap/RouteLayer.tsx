'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap, useStyleVersion } from '@/Components/map/MapContext'
import { getRouteColor, buildColorMatch } from '../../_lib/mapColors'
import type { FeatureCollection, RouteProperties } from '../../_types'
import { useMapStore } from '../../_store/useMapStore'

interface RouteLayerProps {
  data: FeatureCollection<RouteProperties>
}

interface ActiveRoute {
  props: RouteProperties
  x: number
  y: number
}

// Insert transit geometry under the basemap's first symbol layer so street
// names, place labels, POIs and housenumbers stay readable on top of it.
export function firstSymbolLayerId(map: maplibregl.Map): string | undefined {
  const layers = map.getStyle()?.layers
  if (!Array.isArray(layers)) return undefined
  return layers.find((l: any) => l.type === 'symbol')?.id
}

export default function RouteLayer({ data }: RouteLayerProps) {
  const map = useMap()
  const styleVersion = useStyleVersion()
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null)
  const selectedRouteIdRef = useRef(selectedRouteId)
  selectedRouteIdRef.current = selectedRouteId

  const applySelection = useCallback((target: maplibregl.Map, id: string | null) => {
    if (!target.getLayer('routes-line')) return
    if (id) {
      target.setPaintProperty('routes-line', 'line-opacity', [
        'case', ['==', ['get', 'id'], id], 1.0, 0.15,
      ])
      target.setPaintProperty('routes-line', 'line-width', [
        'case', ['==', ['get', 'id'], id], 6, 3,
      ])
    } else {
      target.setPaintProperty('routes-line', 'line-opacity', 0.85)
      target.setPaintProperty('routes-line', 'line-width', 4)
    }
  }, [])

  // Build source + line layer; wire click/hover events
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
    }, firstSymbolLayerId(map))

    // setStyle / a data identity change re-adds this layer with the default
    // paint, so the live selection must be re-applied on every re-add — the
    // selection effect below only runs when the selected id actually changes.
    applySelection(map, selectedRouteIdRef.current)

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (selectedRouteIdRef.current) return
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ]
      const hits = map.queryRenderedFeatures(bbox, { layers: ['routes-line'] })
      map.getCanvas().style.cursor = hits.length > 0 ? 'pointer' : ''
    }

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      if (selectedRouteIdRef.current) return
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 8, e.point.y - 8],
        [e.point.x + 8, e.point.y + 8],
      ]
      const hits = map.queryRenderedFeatures(bbox, { layers: ['routes-line'] })
      if (hits.length > 0) {
        const props = hits[0].properties as RouteProperties
        const container = map.getContainer()
        const mx = Math.min(Math.max(e.point.x, 140), container.clientWidth - 140)
        const my = e.point.y
        setActiveRoute({ props, x: mx, y: my })
        setSelectedRouteId(props.id)
      } else {
        setActiveRoute(null)
        setSelectedRouteId(null)
      }
    }

    map.on('mousemove', onMouseMove)
    map.on('click', onMapClick)

    return () => {
      map.off('mousemove', onMouseMove)
      map.off('click', onMapClick)
      try {
        if (map.getLayer('routes-line')) map.removeLayer('routes-line')
        if (map.getSource('routes-source')) map.removeSource('routes-source')
      } catch { /* map already removed */ }
    }
    // styleVersion: re-add layers after a basemap style swap (setStyle wipes them)
  }, [map, data, setSelectedRouteId, styleVersion, applySelection])

  // Highlight / dim routes when selection changes
  useEffect(() => {
    if (!map) return

    applySelection(map, selectedRouteId)

    // Close the map popup when selection changes from sidebar
    setActiveRoute(null)
  }, [map, selectedRouteId, applySelection])

  if (!activeRoute) return null

  const { props, x, y } = activeRoute
  const color = getRouteColor(props.colorIndex)
  const container = map?.getContainer()
  // Show modal above click if there's room, otherwise below
  const showBelow = container ? y < 160 : false
  const translateY = showBelow ? '8px' : 'calc(-100% - 8px)'

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      onClick={() => { setActiveRoute(null); setSelectedRouteId(null) }}
    >
      {/* Route card */}
      <div
        className="pointer-events-auto absolute rounded-2xl shadow-xl"
        style={{
          left: x,
          top: y,
          transform: `translate(-50%, ${translateY})`,
          background: color,
          minWidth: '120px',
          maxWidth: '220px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-2.5" dir="rtl">
          <span className="flex-1 text-center text-sm font-bold leading-snug text-white">
            {props.nameAr}
          </span>
          <button
            onClick={() => { setActiveRoute(null); setSelectedRouteId(null) }}
            className="shrink-0 rounded-full p-0.5 text-white/70 transition-colors hover:text-white"
            aria-label="إغلاق"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {/* Small pointer triangle */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            [showBelow ? 'top' : 'bottom']: -6,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            ...(showBelow
              ? { borderBottom: `6px solid ${color}` }
              : { borderTop: `6px solid ${color}` }),
          }}
        />
      </div>
    </div>
  )
}
