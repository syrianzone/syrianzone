'use client'

import { useEffect, useState } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from './MapContext'
import { getRouteColor } from '../../_lib/mapColors'
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
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null)

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
    })

    // Wider invisible hit target so thin lines are easy to click
    map.addLayer({
      id: 'routes-line-hit',
      type: 'line',
      source: 'routes-source',
      paint: {
        'line-width': 16,
        'line-opacity': 0,
      },
    })

    const onEnter = () => { map.getCanvas().style.cursor = 'pointer' }
    const onLeave = () => { map.getCanvas().style.cursor = '' }

    const onRouteClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features || e.features.length === 0) return
      const props = e.features[0].properties as RouteProperties
      const container = map.getContainer()
      // Clamp so modal never overflows the map container
      const mx = Math.min(Math.max(e.point.x, 140), container.clientWidth - 140)
      const my = e.point.y
      setActiveRoute({ props, x: mx, y: my })
      setSelectedRouteId(props.id)
    }

    const onMapClick = (e: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: ['routes-line-hit'] })
      if (hits.length === 0) {
        setActiveRoute(null)
        setSelectedRouteId(null)
      }
    }

    map.on('mouseenter', 'routes-line-hit', onEnter)
    map.on('mouseleave', 'routes-line-hit', onLeave)
    map.on('click', 'routes-line-hit', onRouteClick)
    map.on('click', onMapClick)

    return () => {
      map.off('mouseenter', 'routes-line-hit', onEnter)
      map.off('mouseleave', 'routes-line-hit', onLeave)
      map.off('click', 'routes-line-hit', onRouteClick)
      map.off('click', onMapClick)
      try {
        if (map.getLayer('routes-line-hit')) map.removeLayer('routes-line-hit')
        if (map.getLayer('routes-line')) map.removeLayer('routes-line')
        if (map.getSource('routes-source')) map.removeSource('routes-source')
      } catch { /* map already removed */ }
    }
  }, [map, data, setSelectedRouteId])

  // Highlight / dim routes when selection changes
  useEffect(() => {
    if (!map || !map.getLayer('routes-line')) return

    if (selectedRouteId) {
      map.setPaintProperty('routes-line', 'line-opacity', [
        'case', ['==', ['get', 'id'], selectedRouteId], 1.0, 0.15,
      ])
      map.setPaintProperty('routes-line', 'line-width', [
        'case', ['==', ['get', 'id'], selectedRouteId], 6, 3,
      ])
    } else {
      map.setPaintProperty('routes-line', 'line-opacity', 0.85)
      map.setPaintProperty('routes-line', 'line-width', 4)
    }
  }, [map, selectedRouteId])

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
