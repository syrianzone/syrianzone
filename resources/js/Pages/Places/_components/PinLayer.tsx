import { useEffect, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { FeatureCollection } from 'geojson'
import { useMap, useStyleVersion } from '@/Components/map/MapContext'

/**
 * A clustered point layer: a circle per cluster, its count, and a circle per
 * place. The two Places instances (places and hotels) differ only in the ids,
 * colours and which collection they draw, so they share this one component.
 */
export interface PinLayerStyle {
  /** The GeoJSON source id; the layer ids below belong to it. */
  sourceId: string
  clusterLayerId: string
  clusterCountLayerId: string
  pinLayerId: string
  clusterColor: string
  pinColor: string
  strokeColor: string
  /** Pin radius: the clicked/selected pin, then every other pin. */
  pinRadius: { selected: number; idle: number }
}

export const PLACE_PINS: PinLayerStyle = {
  sourceId: 'places',
  clusterLayerId: 'clusters',
  clusterCountLayerId: 'cluster-count',
  pinLayerId: 'place-pin',
  clusterColor: 'hsl(105, 12%, 38%)',
  pinColor: '#7d8a5c',
  strokeColor: '#ffffff',
  pinRadius: { selected: 9, idle: 6 },
}

export const HOTEL_PINS: PinLayerStyle = {
  sourceId: 'hotels',
  clusterLayerId: 'hotel-clusters',
  clusterCountLayerId: 'hotel-cluster-count',
  pinLayerId: 'hotel-pin',
  clusterColor: '#c05621',
  pinColor: '#c05621',
  strokeColor: '#ffffff',
  pinRadius: { selected: 9, idle: 6 },
}

export const PLACE_PIN_LAYERS = [PLACE_PINS.clusterLayerId, PLACE_PINS.clusterCountLayerId, PLACE_PINS.pinLayerId]
export const HOTEL_PIN_LAYERS = [HOTEL_PINS.clusterLayerId, HOTEL_PINS.clusterCountLayerId, HOTEL_PINS.pinLayerId]

/** The pin colour shared with the map's highlight marker. */
export const PLACE_MARKER_COLOR = PLACE_PINS.pinColor

export function PinLayer(props: {
  style: PinLayerStyle
  data: FeatureCollection
  selectedId: number | null
  onPinClick: (id: number) => void
  onClusterClick: (zoom: number, center: [number, number]) => void
}) {
  const map = useMap()
  const styleVersion = useStyleVersion()
  const { style } = props
  const onPinClickRef = useRef(props.onPinClick)
  onPinClickRef.current = props.onPinClick
  const onClusterClickRef = useRef(props.onClusterClick)
  onClusterClickRef.current = props.onClusterClick
  const selectedIdRef = useRef(props.selectedId)
  selectedIdRef.current = props.selectedId
  const dataRef = useRef(props.data)
  dataRef.current = props.data

  const addSourceAndLayers = () => {
    if (map.getSource(style.sourceId)) return
    if (!map.isStyleLoaded?.()) return

    try {
      map.addSource(style.sourceId, {
        type: 'geojson',
        data: dataRef.current,
        cluster: true,
        clusterRadius: 25,
        clusterMaxZoom: 10,
        // Both collections carry a stable numeric `properties.id`, so selection
        // can use GPU feature-state instead of repainting the whole layer.
        promoteId: 'id',
      })

      map.addLayer({
        id: style.clusterLayerId,
        type: 'circle',
        source: style.sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': style.clusterColor,
          'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 10, 10, 13, 30, 16],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': style.strokeColor,
          'circle-stroke-opacity': 0.8,
        },
      })

      map.addLayer({
        id: style.clusterCountLayerId,
        type: 'symbol',
        source: style.sourceId,
        filter: ['has', 'point_count'],
        layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 11, 'text-font': ['IBM Plex Sans Arabic Bold'] },
        paint: { 'text-color': style.strokeColor },
      })

      map.addLayer({
        id: style.pinLayerId,
        type: 'circle',
        source: style.sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['case', ['boolean', ['feature-state', 'selected'], false], style.pinRadius.selected, style.pinRadius.idle],
          'circle-color': style.pinColor,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': style.strokeColor,
          'circle-stroke-opacity': 0.9,
        },
      })

      // A layer added after a slow style load must already show the selection:
      // the selection effect runs once per id, not once per layer creation.
      if (selectedIdRef.current !== null) {
        map.setFeatureState({ source: style.sourceId, id: selectedIdRef.current }, { selected: true })
      }
    } catch (error) {
      console.warn(`[${style.sourceId} layer] addSource/addLayer failed:`, error)
    }
  }

  // add source + layers on mount (re-adds after setStyle via style.load)
  useEffect(() => {
    const onStyleLoad = () => {
      addSourceAndLayers()
    }
    let idleFired = false
    const onIdle = () => {
      if (idleFired) return
      idleFired = true
      addSourceAndLayers()
      map.off('idle', onIdle)
    }

    addSourceAndLayers()
    map.on('style.load', onStyleLoad)
    map.on('idle', onIdle)

    const onClusterClick = async (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0]
      if (!feature) return
      const source = map.getSource(style.sourceId) as maplibregl.GeoJSONSource
      const zoom = await source.getClusterExpansionZoom(feature.properties?.cluster_id)
      const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number]
      map.easeTo({ center: coords, zoom })
      onClusterClickRef.current(zoom, coords)
    }

    const onPinClick = (e: maplibregl.MapLayerMouseEvent) => {
      // MapLibre serialises GeoJSON properties to strings; coerce before use
      const raw = e.features?.[0]?.properties?.id
      const id = raw != null ? Number(raw) : NaN
      if (!isNaN(id)) onPinClickRef.current(id)
    }

    map.on('click', style.clusterLayerId, onClusterClick)
    map.on('click', style.pinLayerId, onPinClick)

    return () => {
      map.off('style.load', onStyleLoad)
      map.off('idle', onIdle)
      map.off('click', style.clusterLayerId, onClusterClick)
      map.off('click', style.pinLayerId, onPinClick)
      try {
        for (const layer of [style.clusterLayerId, style.clusterCountLayerId, style.pinLayerId]) {
          if (map.getLayer(layer)) map.removeLayer(layer)
        }
        if (map.getSource(style.sourceId)) map.removeSource(style.sourceId)
      } catch { /* map tearing down */ }
    }
  }, [map, style])

  // update data
  useEffect(() => {
    try {
      let source = map.getSource(style.sourceId)
      if (!source && map.isStyleLoaded?.()) {
        addSourceAndLayers()
        source = map.getSource(style.sourceId)
      }
      if (source) (source as maplibregl.GeoJSONSource).setData(props.data)
    } catch { /* map style may not be ready */ }
  }, [props.data, map, style])

  // Selection via GPU feature-state. A style swap drops the state, so it is
  // re-applied here too (styleVersion changes when MapCanvas re-adds styles).
  const prevSelectedIdRef = useRef<number | null>(null)
  useEffect(() => {
    try {
      if (!map.getSource(style.sourceId)) return
      if (prevSelectedIdRef.current !== null) {
        map.setFeatureState({ source: style.sourceId, id: prevSelectedIdRef.current }, { selected: false })
      }
      if (props.selectedId !== null) {
        map.setFeatureState({ source: style.sourceId, id: props.selectedId }, { selected: true })
      }
      prevSelectedIdRef.current = props.selectedId
    } catch { /* layer not ready */ }
  }, [props.selectedId, map, style, styleVersion])

  return null
}
