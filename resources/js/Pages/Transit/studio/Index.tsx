'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { router, Link, Head } from '@inertiajs/react'
import type { FeatureCollection, Position } from 'geojson'
import {
  Route,
  MapPin,
  Palette,
  FileText,
  Check,
  RotateCcw,
  Undo2,
  Send,
  Loader2,
  Sparkles,
  ArrowLeft,
  Plus,
  Trash2,
  UserCheck,
  UserX
} from 'lucide-react'
import { useStudioStore, type StopFeature } from '../_store/useStudioStore'
import { useMapData } from '../_hooks/useMapData'
import cities from '../_data/cities.json'
import TransitLayout from '../layout'
import { useTransitTheme } from '../_components/TransitThemeContext'
import { THEME_REGISTRY } from '@/Lib/theme'
import { useAuth } from '@/Contexts/AuthContext'
import { ROUTE_PALETTE, getRouteColor, buildColorMatch } from '../_lib/mapColors'
import { BottomSheet } from '../_components/BottomSheet'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/Components/ui/accordion'
import { Button } from '@/Components/ui/button'
import { Input } from '@/Components/ui/input'
import { Textarea } from '@/Components/ui/textarea'
import { Badge } from '@/Components/ui/badge'
import { Toaster, toast } from '@/Components/ui/sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/Components/ui/select'

// RTL text shaping for Arabic labels on the vector basemap
if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
  maplibregl.setRTLTextPlugin('/styles/mapbox-gl-rtl-text.min.js', true)
}

// ─── Types ────────────────────────────────────────────────────────────────────
type DrawMode = 'idle' | 'line' | 'point'

// ─── Map layer IDs ────────────────────────────────────────────────────────────
const SRC_LINES      = 'studio-lines'
const SRC_STOPS      = 'studio-stops'
const SRC_ACTIVE     = 'studio-active'
const SRC_REF_ROUTES = 'ref-routes'
const SRC_REF_STOPS  = 'ref-stops'

// ─── Conflict detection helpers ───────────────────────────────────────────────
function getBbox(coords: [number, number][]): [number, number, number, number] {
  const lngs = coords.map(c => c[0])
  const lats = coords.map(c => c[1])
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}

function checkConflict(drawnLine: [number, number][], routeFeatures: any[]): boolean {
  if (!routeFeatures.length) return false
  const [minX, minY, maxX, maxY] = getBbox(drawnLine)
  const drawnArea = (maxX - minX) * (maxY - minY)
  if (drawnArea === 0) return false
  for (const feat of routeFeatures) {
    if (!feat.geometry?.coordinates) continue
    const coords = feat.geometry.coordinates as [number, number][]
    const [bX, bY, bX2, bY2] = getBbox(coords)
    const ix1 = Math.max(minX, bX), iy1 = Math.max(minY, bY)
    const ix2 = Math.min(maxX, bX2), iy2 = Math.min(maxY, bY2)
    if (ix2 > ix1 && iy2 > iy1) {
      if (((ix2 - ix1) * (iy2 - iy1)) / drawnArea > 0.6) return true
    }
  }
  return false
}

// Find nearest point on a line segment
function nearestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: ax, y: ay, t: 0 }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return { x: ax + t * dx, y: ay + t * dy, t }
}

// Find the nearest segment in a polyline
function findNearestSegment(coords: [number, number][], px: number, py: number, map: maplibregl.Map) {
  let minDist = Infinity
  let insertIdx = 0
  let bestNearest = { x: px, y: py }
  const pxC = map.project([px, py])

  for (let i = 0; i < coords.length - 1; i++) {
    const [ax, ay] = coords[i]
    const [bx, by] = coords[i + 1]
    const np = nearestOnSegment(px, py, ax, ay, bx, by)
    const npPx = map.project([np.x, np.y])
    const dist = Math.hypot(pxC.x - npPx.x, pxC.y - npPx.y)
    if (dist < minDist) {
      minDist = dist
      insertIdx = i + 1
      bestNearest = { x: np.x, y: np.y }
    }
  }
  return { insertIdx, distance: minDist, nearest: bestNearest }
}

function SuccessPanel({ draftId, isEditMode, isAnonymous, onReset, onEdit, onExit }: {
  draftId: number
  isEditMode: boolean
  isAnonymous?: boolean
  onReset: () => void
  onEdit: () => void
  onExit: () => void
}) {
  return (
    <div className="p-4 bg-card rounded-xl border border-border shadow-xs text-center space-y-4">
      <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
        <Check className="w-6 h-6 stroke-[3]" />
      </div>
      <div>
        <h3 className="text-base font-bold text-foreground">
          {isEditMode ? 'تم تحديث المسار بنجاح!' : 'تم إرسال المسودة بنجاح!'}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {isAnonymous
            ? `تم إرسال المسودة كزائر (رقم المسودة #${draftId}). سيقوم مشرفو النظام بمراجعتها ونشرها قريباً.`
            : isEditMode
            ? 'تم حفظ التعديلات بنجاح وستظهر فوراً على الخريطة التفاعلية.'
            : `رقم المسودة #${draftId}. تمت مراجعة المساهمة وسيقوم المشرفون بالتحقق منها قريباً.`}
        </p>
      </div>

      <div className="space-y-2 pt-2">
        <Button type="button" onClick={onEdit} variant="outline" className="w-full text-xs h-9">
          تعديل المسار الحالي
        </Button>
        <Button type="button" onClick={onReset} className="w-full text-xs h-9">
          رسم مسار جديد
        </Button>
        <Button type="button" onClick={onExit} variant="ghost" className="w-full text-xs h-8 text-muted-foreground">
          العودة لخريطة المواصلات
        </Button>
      </div>
    </div>
  )
}

function StopNamePopup({ stop, pixel, onConfirm, onDismiss }: {
  stop: StopFeature
  pixel: { x: number; y: number }
  onConfirm: (name: string) => void
  onDismiss: () => void
}) {
  const [name, setName] = useState(stop.nameAr)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  return (
    <div
      className="studio-stop-popup"
      style={{ left: pixel.x + 12, top: pixel.y - 28 }}
    >
      <input
        ref={inputRef}
        type="text"
        className="studio-input studio-stop-popup-input"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="اسم المحطة…"
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); onConfirm(name) }
          if (e.key === 'Escape') onDismiss()
        }}
      />
      <button type="button" className="studio-stop-popup-btn" onClick={() => onConfirm(name)}>
        تم
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function TransitStudioPageContent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const currentStyleRef = useRef<string | null>(null)
  const modeRef      = useRef<DrawMode>('idle')
  const activeLine   = useRef<Position[]>([])
  const isMobileRef  = useRef(false)
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([])
  const stopMarkersRef = useRef<maplibregl.Marker[]>([])
  const lastTouchTimeRef = useRef<number>(0)

  const {
    cityId, drawnLine, stops, nameAr, nameEn, price, notes, submittedDraftId,
    colorIndex, setColorIndex,
    isEditMode, editingDraftId, editingRouteId,
    setCity, setDrawnLine, addStop, removeStop, updateStopName, updateStopCoordinates, setMeta, setSubmittedDraftId,
    reset, loadDraft
  } = useStudioStore()
  const { theme } = useTransitTheme()
  const { user } = useAuth()

  const [mapReady,           setMapReady]           = useState(false)
  const [drawMode,           setDrawMode]           = useState<DrawMode>('idle')
  const [activeVertexCount,  setActiveVertexCount]  = useState(0)
  const [activeStopId,       setActiveStopId]       = useState<number | null>(null)
  const [activeStopPixel,    setActiveStopPixel]    = useState<{ x: number; y: number } | null>(null)
  const [conflictWarning,    setConflictWarning]    = useState(false)
  const [conflictDismissed,  setConflictDismissed]  = useState(false)
  const [submitting,         setSubmitting]         = useState(false)
  const [accordionValue,     setAccordionValue]     = useState<string>('line')
  const [lastSubmittedIsAnon, setLastSubmittedIsAnon] = useState(false)

  const { data: refData } = useMapData(cityId || undefined)
  const activeCities = cities.filter(c => c.status === 'active')
  const currentCity = cities.find(c => c.id === cityId) || activeCities[0]

  // ─── Shadcn Sonner Toast Notification Handler ───────────────────────────────
  const addToast = useCallback((msg: string, type: 'success' | 'destructive' | 'info' | 'warning' = 'info') => {
    if (type === 'success') {
      toast.success(msg)
    } else if (type === 'destructive') {
      toast.error(msg)
    } else if (type === 'warning') {
      toast.warning(msg)
    } else {
      toast.info(msg)
    }
  }, [])

  // Helper to ensure MapLibre custom sources & layers exist (survives setStyle)
  const ensureMapLayers = useCallback((map: maplibregl.Map, currentColorIndex: number) => {
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    const activeColor = getRouteColor(currentColorIndex)

    if (!map.getSource(SRC_REF_ROUTES)) {
      map.addSource(SRC_REF_ROUTES, { type: 'geojson', data: empty })
      map.addLayer({
        id: 'ref-layer-routes',
        type: 'line',
        source: SRC_REF_ROUTES,
        paint: { 'line-color': buildColorMatch() as any, 'line-width': 3, 'line-opacity': 0.4 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    if (!map.getSource(SRC_REF_STOPS)) {
      map.addSource(SRC_REF_STOPS, { type: 'geojson', data: empty })
      map.addLayer({
        id: 'ref-layer-stops',
        type: 'circle',
        source: SRC_REF_STOPS,
        paint: { 'circle-radius': 4, 'circle-color': '#d4956a', 'circle-opacity': 0.4 },
      })
    }

    if (!map.getSource(SRC_LINES)) {
      map.addSource(SRC_LINES, { type: 'geojson', data: empty })
      map.addLayer({
        id: 'studio-layer-lines',
        type: 'line',
        source: SRC_LINES,
        paint: { 'line-color': activeColor, 'line-width': 6, 'line-opacity': 0.95 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
    }

    if (!map.getSource(SRC_ACTIVE)) {
      map.addSource(SRC_ACTIVE, { type: 'geojson', data: empty })
      map.addLayer({
        id: 'studio-layer-active',
        type: 'line',
        source: SRC_ACTIVE,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': activeColor, 'line-width': 5, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      map.addLayer({
        id: 'studio-layer-vertices',
        type: 'circle',
        source: SRC_ACTIVE,
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 6, 'circle-color': activeColor, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 },
      })
    }
  }, [])

  // Active-line source helpers
  const flushActive = useCallback((coords: Position[], cursor?: Position) => {
    if (!mapRef.current) return
    const map = mapRef.current
    ensureMapLayers(map, colorIndex)

    const src = map.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    const features: any[] = []
    const all = cursor && coords.length > 0 ? [...coords, cursor] : coords
    if (all.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: all } })
    coords.forEach(c => features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
    src.setData({ type: 'FeatureCollection', features })
  }, [ensureMapLayers, colorIndex])

  const clearActive = useCallback(() => {
    activeLine.current = []
    setActiveVertexCount(0)
    if (!mapRef.current) return
    const src = mapRef.current.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: [] })
  }, [])

  // Mode switching
  const setMode = useCallback((mode: DrawMode) => {
    clearActive()
    modeRef.current = mode
    setDrawMode(mode)
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = mode !== 'idle' ? 'crosshair' : ''
  }, [clearActive])

  // Finish / End line editing or drawing on double-click / double-tap
  const finishLineEditing = useCallback(() => {
    if (modeRef.current !== 'line') return

    if (activeLine.current.length >= 2) {
      const finalLine = [...activeLine.current]
      setDrawnLine(finalLine)
      setMode('idle')
      addToast(`اكتمل رسم المسار (${finalLine.length} نقطة)`, 'success')

      if (refData?.routes?.features?.length) {
        const conflict = checkConflict(finalLine, refData.routes.features)
        setConflictWarning(conflict)
        setConflictDismissed(false)
      }
      setAccordionValue('stops')
    } else {
      const curDrawn = useStudioStore.getState().drawnLine
      if (curDrawn && curDrawn.length >= 2) {
        setMode('idle')
        addToast(`تم إنهاء تعديل المسار (${curDrawn.length} نقطة)`, 'success')
        setAccordionValue('stops')
      } else {
        addToast('يجب رسم نقطتين على الأقل', 'destructive')
      }
    }
  }, [addToast, refData, setDrawnLine, setMode])

  // Focus station input in sidebar and scroll to it
  const handleFocusStationInput = useCallback((stopId: number) => {
    setAccordionValue('stops')
    setActiveStopId(stopId)
    setTimeout(() => {
      const inputEl = document.getElementById(`stop-input-${stopId}`)
      if (inputEl) {
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
        inputEl.focus()
      }
    }, 150)
  }, [])

  // Restore pending session after login redirect
  useEffect(() => {
    const pending = localStorage.getItem('transit:studio:pending')
    if (pending) {
      try {
        const s = JSON.parse(pending)
        const patch: any = {}
        if (s.cityId) patch.cityId = s.cityId
        if (s.drawnLine) patch.drawnLine = s.drawnLine
        if (s.stops) patch.stops = s.stops
        if (s.nameAr !== undefined) patch.nameAr = s.nameAr
        if (s.nameEn !== undefined) patch.nameEn = s.nameEn
        if (s.price !== undefined) patch.price = s.price
        if (s.notes !== undefined) patch.notes = s.notes
        if (s.editingRouteId) { patch.editingRouteId = s.editingRouteId; patch.isEditMode = true }
        useStudioStore.setState(patch)
        addToast('تمت استعادة مسارك لتقديمه تحت حسابك المسجل', 'success')
      } catch { /* */ }
      localStorage.removeItem('transit:studio:pending')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load draft for editing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('edit')
    if (!editId || isEditMode) return
    fetch(`/api/v1/studio/routes/${editId}`, { credentials: 'include' })
      .then(r => {
        if (r.ok) return r.json().then(draft => ({ draft, isRoute: false }))
        return fetch(`/api/v1/studio/routes/${editId}/from-route`, { credentials: 'include' })
          .then(r2 => r2.ok ? r2.json().then(d => ({ draft: d, isRoute: true })) : null)
      })
      .then(result => {
        if (result) {
          loadDraft(result.draft)
          addToast(result.isRoute ? 'تم تحميل الخط المنشور للتعديل' : 'تم تحميل المسار للتعديل', 'success')
        }
      })
      .catch(() => addToast('تعذّر تحميل المسار للتعديل', 'destructive'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Center & Fit bounds on city select, bounding user to city boundaries
  const handleCitySelect = useCallback((cId: string) => {
    setCity(cId)
    const c = cities.find(x => x.id === cId)
    if (c && mapRef.current) {
      const sw = c.bounds[0] as [number, number]
      const ne = c.bounds[1] as [number, number]

      mapRef.current.fitBounds([sw, ne], { padding: 50, duration: 1200 })

      const paddedBounds: maplibregl.LngLatBoundsLike = [
        [sw[0] - 0.08, sw[1] - 0.08],
        [ne[0] + 0.08, ne[1] + 0.08]
      ]
      mapRef.current.setMaxBounds(paddedBounds)
    }
  }, [setCity])

  // Set default city if empty
  useEffect(() => {
    if (!cityId && activeCities.length > 0) {
      handleCitySelect(activeCities[0].id)
    }
  }, [cityId, activeCities, handleCitySelect])

  // Zoom to fit route when editing
  useEffect(() => {
    if (!mapReady || !mapRef.current || !drawnLine || drawnLine.length < 2 || !isEditMode) return
    const map = mapRef.current
    const coords = drawnLine as maplibregl.LngLatLike[]
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
    map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 500 })
  }, [mapReady, drawnLine, isEditMode])

  // Helper to check dark mode state
  const isDarkMode = useCallback(() => {
    const html = document.documentElement
    const themeConfig = THEME_REGISTRY.find((t) => t.id === theme)
    return (
      html.classList.contains('dark') ||
      html.getAttribute('data-theme') === 'dark' ||
      (themeConfig?.isDark ?? false)
    )
  }, [theme])

  // Map initialization with User's Color Theme
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const dark = isDarkMode()
    const initCity = cities.find(c => c.id === cityId) || activeCities[0]
    const initialStyle = dark ? '/styles/styles/dark-matter-vector.json' : '/styles/styles/light-vector.json'
    currentStyleRef.current = initialStyle

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: initialStyle,
      center: initCity ? (initCity.center as [number, number]) : [36.2913, 33.5138],
      zoom: initCity ? initCity.zoom : 12,
      attributionControl: false,
      doubleClickZoom: false,
    })

    if (initCity) {
      const sw = initCity.bounds[0] as [number, number]
      const ne = initCity.bounds[1] as [number, number]
      map.setMaxBounds([[sw[0] - 0.08, sw[1] - 0.08], [ne[0] + 0.08, ne[1] + 0.08]])
    }

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'bottom-right'
    )

    map.on('load', () => {
      ensureMapLayers(map, colorIndex)
      mapRef.current = map
      setMapReady(true)
    })

    isMobileRef.current = window.innerWidth <= 768
    const handleResize = () => { isMobileRef.current = window.innerWidth <= 768 }
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      map.remove()
      mapRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Dynamically sync Map vector style ONLY when dark/light style actually changes
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const applyStyleIfNeeded = () => {
      const dark = isDarkMode()
      const targetStyle = dark ? '/styles/styles/dark-matter-vector.json' : '/styles/styles/light-vector.json'

      if (currentStyleRef.current !== targetStyle) {
        currentStyleRef.current = targetStyle
        map.setStyle(targetStyle)
        map.once('styledata', () => {
          ensureMapLayers(map, colorIndex)
          if (useStudioStore.getState().drawnLine) {
            const lSrc = map.getSource(SRC_LINES) as maplibregl.GeoJSONSource
            lSrc?.setData({
              type: 'FeatureCollection',
              features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: useStudioStore.getState().drawnLine } }]
            })
          }
        })
      }
    }

    applyStyleIfNeeded()

    const observer = new MutationObserver(applyStyleIfNeeded)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
  }, [mapReady, theme, isDarkMode, colorIndex, ensureMapLayers])

  // Sync reference routes/stops for current city
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    ensureMapLayers(map, colorIndex)
    const rSrc = map.getSource(SRC_REF_ROUTES) as maplibregl.GeoJSONSource | undefined
    const sSrc = map.getSource(SRC_REF_STOPS) as maplibregl.GeoJSONSource | undefined

    if (refData) {
      rSrc?.setData(refData.routes)
      sSrc?.setData(refData.stops)
    } else {
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
      rSrc?.setData(empty)
      sSrc?.setData(empty)
    }
  }, [mapReady, refData, colorIndex, ensureMapLayers])

  // Sync line color on vector map
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    ensureMapLayers(map, colorIndex)

    const color = getRouteColor(colorIndex)
    if (map.getLayer('studio-layer-lines')) {
      map.setPaintProperty('studio-layer-lines', 'line-color', color)
    }
    if (map.getLayer('studio-layer-active')) {
      map.setPaintProperty('studio-layer-active', 'line-color', color)
    }
    if (map.getLayer('studio-layer-vertices')) {
      map.setPaintProperty('studio-layer-vertices', 'circle-color', color)
    }
  }, [mapReady, colorIndex, ensureMapLayers])

  // Sync drawn line to vector map layer
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    ensureMapLayers(map, colorIndex)

    const src = map.getSource(SRC_LINES) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    if (drawnLine && drawnLine.length >= 2) {
      src.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: drawnLine } }],
      })
    } else {
      src.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [mapReady, drawnLine, colorIndex, ensureMapLayers])

  // Render draggable vertex markers on the drawn line with live bus stop re-snapping
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    vertexMarkersRef.current.forEach(m => m.remove())
    vertexMarkersRef.current = []

    if (!drawnLine || drawnLine.length < 2) return

    const activeColor = getRouteColor(colorIndex)

    drawnLine.forEach((coord, idx) => {
      const el = document.createElement('div')
      el.className = 'studio-vertex-marker w-4 h-4 rounded-full border-2 border-white shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-10'
      el.style.backgroundColor = activeColor
      el.title = `نقطة ${idx + 1} — اسحب للتعديل • انقر مرتين لإنهاء التعديل • انقر يميناً للحذف`

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(coord as maplibregl.LngLatLike)
        .addTo(map)

      // Live dragging of vertex points with real-time bus stop re-snapping
      marker.on('drag', () => {
        const newPos = marker.getLngLat()
        const curLine = [...useStudioStore.getState().drawnLine!]
        curLine[idx] = [newPos.lng, newPos.lat]

        // 1. Update line vector layer live
        const src = map.getSource(SRC_LINES) as maplibregl.GeoJSONSource
        src?.setData({
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: curLine } }]
        })

        // 2. Re-snap stop markers on the map live in real-time to the updated line
        const curStops = useStudioStore.getState().stops
        stopMarkersRef.current.forEach((stopMarker, sIdx) => {
          const stop = curStops[sIdx]
          if (stop && curLine.length >= 2) {
            const { nearest } = findNearestSegment(curLine, stop.coordinates[0], stop.coordinates[1], map)
            stopMarker.setLngLat([nearest.x, nearest.y])
          }
        })
      })

      marker.on('dragend', () => {
        const newPos = marker.getLngLat()
        const updatedLine = [...useStudioStore.getState().drawnLine!]
        updatedLine[idx] = [newPos.lng, newPos.lat]
        setDrawnLine(updatedLine)

        // Commit updated snapped stop coordinates to Zustand store
        const curStops = useStudioStore.getState().stops
        if (curStops.length > 0 && updatedLine.length >= 2) {
          curStops.forEach((stop) => {
            const { nearest } = findNearestSegment(updatedLine, stop.coordinates[0], stop.coordinates[1], map)
            updateStopCoordinates(stop.id, [nearest.x, nearest.y])
          })
        }
      })

      // Double click on vertex marker to finish editing
      el.addEventListener('dblclick', (ev) => {
        ev.stopPropagation()
        ev.preventDefault()
        finishLineEditing()
      })

      // Right-click / context menu to remove single vertex
      el.addEventListener('contextmenu', (ev) => {
        ev.preventDefault()
        const cur = useStudioStore.getState().drawnLine!
        if (cur.length <= 2) {
          addToast('يجب أن يحتوي المسار على نقطتين على الأقل', 'info')
          return
        }
        const updatedLine = cur.filter((_, i) => i !== idx)
        setDrawnLine(updatedLine)

        // Re-snap stops to the updated line after vertex removal
        const curStops = useStudioStore.getState().stops
        if (curStops.length > 0 && updatedLine.length >= 2) {
          curStops.forEach((stop) => {
            const { nearest } = findNearestSegment(updatedLine, stop.coordinates[0], stop.coordinates[1], map)
            updateStopCoordinates(stop.id, [nearest.x, nearest.y])
          })
        }
        addToast('تمت إزالة النقطة وإعادة محاذاة المحطات على المسار', 'info')
      })

      vertexMarkersRef.current.push(marker)
    })
  }, [mapReady, drawnLine, colorIndex, setDrawnLine, updateStopCoordinates, addToast, finishLineEditing])

  // Render bus stop dots with smooth continuous line snapping during drag
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    stopMarkersRef.current.forEach(m => m.remove())
    stopMarkersRef.current = []

    const activeColor = getRouteColor(colorIndex)

    stops.forEach((stop, idx) => {
      const el = document.createElement('div')
      el.className = 'studio-stop-marker flex items-center justify-center w-6.5 h-6.5 rounded-full border-2 border-white shadow-lg text-white text-[11px] font-black cursor-grab active:cursor-grabbing hover:scale-110 transition-transform select-none z-20'
      el.style.backgroundColor = activeColor
      el.innerHTML = `<span>${idx + 1}</span>`
      el.title = stop.nameAr || `محطة ${idx + 1} — انقر للتعديل • اسحب لنقل المحطة على الخط`

      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat(stop.coordinates as maplibregl.LngLatLike)
        .addTo(map)

      // Click dot: open sheet/sidebar, scroll to & focus option to edit station name
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        handleFocusStationInput(stop.id)
      })

      // Smooth real-time snapping during drag (WITHOUT triggering React re-renders)
      marker.on('drag', () => {
        const newPos = marker.getLngLat()
        const curLine = useStudioStore.getState().drawnLine
        if (curLine && curLine.length >= 2) {
          const { nearest } = findNearestSegment(curLine, newPos.lng, newPos.lat, map)
          const snapped: [number, number] = [nearest.x, nearest.y]
          marker.setLngLat(snapped)
        }
      })

      // Commit final snapped coordinates to store ONLY when drag finishes
      marker.on('dragend', () => {
        const finalPos = marker.getLngLat()
        const curLine = useStudioStore.getState().drawnLine
        if (curLine && curLine.length >= 2) {
          const { nearest } = findNearestSegment(curLine, finalPos.lng, finalPos.lat, map)
          const snapped: [number, number] = [nearest.x, nearest.y]
          marker.setLngLat(snapped)
          updateStopCoordinates(stop.id, snapped)
        } else {
          updateStopCoordinates(stop.id, [finalPos.lng, finalPos.lat])
        }
      })

      stopMarkersRef.current.push(marker)
    })
  }, [mapReady, stops, colorIndex, updateStopCoordinates, handleFocusStationInput])

  // Map Click Handler for drawing lines & adding stops snapped onto line
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const point: [number, number] = [e.lngLat.lng, e.lngLat.lat]

      if (modeRef.current === 'line') {
        const curDrawn = useStudioStore.getState().drawnLine
        if (curDrawn && curDrawn.length >= 2 && activeLine.current.length === 0) {
          const updated = [...curDrawn, point]
          setDrawnLine(updated)
          addToast(`تمت إضافة نقطة جديدة للمسار (${updated.length} نقطة)`, 'info')
          return
        }

        activeLine.current.push(point)
        const count = activeLine.current.length
        setActiveVertexCount(count)
        flushActive(activeLine.current)

        if (count === 1) addToast('انقر لإضافة نقاط إضافية • انقر مرتين لإنهاء الرسم والتعديل', 'info')
      } else if (modeRef.current === 'point') {
        const curLine = useStudioStore.getState().drawnLine
        if (curLine && curLine.length >= 2) {
          const { nearest } = findNearestSegment(curLine, point[0], point[1], map)
          const snappedPoint: [number, number] = [nearest.x, nearest.y]
          addStop(snappedPoint)
          const newStops = useStudioStore.getState().stops
          const added = newStops[newStops.length - 1]
          if (added) {
            handleFocusStationInput(added.id)
          }
          addToast('تمت إضافة محطة ومحاذاتها لموقعها على الخط', 'success')
          return
        }
        addStop(point)
        const newStops = useStudioStore.getState().stops
        const added = newStops[newStops.length - 1]
        if (added) {
          handleFocusStationInput(added.id)
        }
        addToast('تمت إضافة محطة', 'success')
      }
    }

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.originalEvent.preventDefault()
      finishLineEditing()
    }

    const onTouchEnd = () => {
      if (modeRef.current === 'line') {
        const now = Date.now()
        if (now - lastTouchTimeRef.current < 300) {
          finishLineEditing()
        }
        lastTouchTimeRef.current = now
      }
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (modeRef.current === 'line' && activeLine.current.length > 0) {
        flushActive(activeLine.current, [e.lngLat.lng, e.lngLat.lat])
      }
    }

    map.on('click', onClick)
    map.on('dblclick', onDblClick)
    map.on('touchend', onTouchEnd)
    map.on('mousemove', onMouseMove)

    return () => {
      map.off('click', onClick)
      map.off('dblclick', onDblClick)
      map.off('touchend', onTouchEnd)
      map.off('mousemove', onMouseMove)
    }
  }, [mapReady, addStop, setDrawnLine, flushActive, addToast, finishLineEditing, handleFocusStationInput])

  // Key press shortcuts (Esc to cancel drawing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modeRef.current === 'line') {
        finishLineEditing()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [finishLineEditing])

  // Drawing Actions
  const handleStartDraw = () => {
    setAccordionValue('line')
    setMode('line')
    addToast('انقر على الخريطة لبدء رسم المسار', 'info')
  }

  const handleRedraw = () => {
    setDrawnLine(null)
    setConflictWarning(false)
    setAccordionValue('line')
    setMode('line')
    addToast('تمت إزالة الخط. انقر على الخريطة لرسم مسار جديد.', 'info')
  }

  const handleUndo = () => {
    if (activeLine.current.length > 0) {
      activeLine.current.pop()
      const count = activeLine.current.length
      setActiveVertexCount(count)
      flushActive(activeLine.current)
    } else if (drawnLine && drawnLine.length > 2) {
      const updated = drawnLine.slice(0, -1)
      setDrawnLine(updated)
      addToast('تمت إزالة النقطة الأخيرة من المسار', 'info')
    }
  }

  const handleActivatePoint = () => {
    setAccordionValue('stops')
    setMode('point')
    addToast('انقر على الخريطة لوضع محطات الحافلات (تتحاذى وتتحرك على الخط)', 'info')
  }

  const handleConfirmStopName = (name: string) => {
    if (activeStopId !== null) {
      updateStopName(activeStopId, name)
      setActiveStopId(null)
      setActiveStopPixel(null)
    }
  }

  const handleDismissStopPopup = () => {
    setActiveStopId(null)
    setActiveStopPixel(null)
  }

  const handleReset = () => {
    setMode('idle')
    reset()
    setAccordionValue('line')
    addToast('تمت إعادة ضبط الاستوديو', 'info')
  }

  // Submit Draft to Backend API (Supports Anonymous and Authenticated mode)
  const handleSubmit = async (requireLogin: boolean = false) => {
    if (!nameAr.trim()) {
      addToast('اسم المسار بالعربية مطلوب', 'destructive')
      setAccordionValue('details')
      return
    }
    if (!drawnLine || drawnLine.length < 2) {
      addToast('يجب رسم خط المسار أولاً', 'destructive')
      setAccordionValue('line')
      return
    }

    if (requireLogin && !user) {
      const stateToSave = { cityId, drawnLine, stops, nameAr, nameEn, price, notes, editingRouteId }
      localStorage.setItem('transit:studio:pending', JSON.stringify(stateToSave))
      addToast('يرجى تسجيل الدخول بحساب Google لتُنسب المساهمة لك', 'info')
      window.location.href = '/auth/google'
      return
    }

    setSubmitting(true)

    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { colorIndex, color_index: colorIndex },
          geometry: { type: 'LineString', coordinates: drawnLine },
        },
        ...stops.map((s) => ({
          type: 'Feature',
          properties: { nameAr: s.nameAr },
          geometry: { type: 'Point' as const, coordinates: s.coordinates },
        })),
      ],
    }

    const payload = {
      city_id: cityId,
      name_ar: nameAr.trim(),
      name_en: nameEn.trim() || null,
      price: price ? parseFloat(price) : null,
      notes: notes.trim() || null,
      color_index: colorIndex,
      geojson,
      route_id: editingRouteId || null,
    }

    try {
      const isUpdating = isEditMode && editingDraftId
      const url = isUpdating ? `/api/v1/studio/routes/${editingDraftId}` : '/api/v1/studio/routes'
      const method = isUpdating ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })

      const data = await res.json()

      if (res.ok) {
        setLastSubmittedIsAnon(!user)
        setSubmittedDraftId(data.id ?? 1)
        addToast(
          !user
            ? 'تم إرسال المسودة بنجاح كزائر (مجهول)'
            : isUpdating
            ? 'تم تحديث المسودة بنجاح'
            : 'تم إرسال المسودة للمراجعة باسمك',
          'success'
        )
      } else {
        const msg = data.message || (data.errors ? Object.values(data.errors).flat().join(' • ') : 'حدث خطأ أثناء الإرسال')
        addToast(msg, 'destructive')
      }
    } catch {
      addToast('تعذّر الاتصال بالخادم. يرجى المحاولة لاحقاً.', 'destructive')
    } finally {
      setSubmitting(false)
    }
  }

  const activeStop = stops.find((s) => s.id === activeStopId)

  // Common inner sidebar content shared between desktop sidebar & mobile BottomSheet
  const sidebarControlsContent = (
    <div className="studio-sidebar-inner p-3.5 overflow-y-auto flex-1 space-y-3">
      {/* Top Navigation & User Contributions in Sidebar */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <Link
          href="/transit"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          title="العودة لخريطة المواصلات"
        >
          <ArrowLeft className="w-3.5 h-3.5 rotate-180" />
          <span>العودة لترانزيت</span>
        </Link>

        {user ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            title="مساهماتي المسجلة"
          >
            <UserCheck className="w-3.5 h-3.5" />
            مساهماتي
          </Link>
        ) : (
          <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
            <UserX className="w-3 h-3" />
            زائر
          </Badge>
        )}
      </div>

      {submittedDraftId !== null ? (
        <SuccessPanel
          draftId={submittedDraftId}
          isEditMode={isEditMode}
          isAnonymous={lastSubmittedIsAnon}
          onReset={handleReset}
          onEdit={() => { setSubmittedDraftId(null); setAccordionValue('details') }}
          onExit={() => router.push('/transit')}
        />
      ) : (
        <>
          {/* 1. FIRST: City Selection & Map Boundary Constraint */}
          <div className="p-3 bg-muted/40 rounded-xl border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                1. اختر المدينة أولاً
              </span>
              <Badge variant="outline" className="text-[10px]">
                {currentCity?.routeCount ?? 0} مسار منشور
              </Badge>
            </div>

            <Select value={cityId} onValueChange={(id) => handleCitySelect(id)}>
              <SelectTrigger className="w-full h-9 text-xs font-semibold bg-background border-input">
                <SelectValue placeholder="اختر المدينة..." />
              </SelectTrigger>
              <SelectContent>
                {activeCities.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">
                    {c.nameAr} ({c.routeCount} مسار)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <p className="text-[10px] text-muted-foreground leading-tight">
              يتم ضبط نطاق الخريطة والتقريب تلقائياً على حدود مدينة {currentCity?.nameAr}.
            </p>
          </div>

          {/* 2. THEN: RTL Shadcn Accordions with Data & Tools */}
          <Accordion
            type="single"
            value={accordionValue}
            onValueChange={(val) => setAccordionValue(val)}
            className="w-full space-y-2.5"
          >
            {/* Accordion 1: Line Tool */}
            <AccordionItem value="line">
              <AccordionTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <Route className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">أداة رسم وتعديل المسار</span>
                </div>
                {drawnLine ? (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shrink-0 me-1">
                    ✓ مرسوم ({drawnLine.length} نقطة)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 me-1">
                    لم يكتمل
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ارسم أو عدّل خط المسار على الخريطة. انقر مرتين أو اضغط مرتين على الخريطة لإنهاء وضع التعديل ورسم الخط.
                  </p>

                  {conflictWarning && !conflictDismissed && (
                    <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[11px] text-amber-700 dark:text-amber-300 flex items-start justify-between gap-2">
                      <span>⚠ يوجد مسار قريب بالفعل. تأكد أن مسارك يختلف أو يكمل الخطوط الحالية.</span>
                      <button type="button" onClick={() => setConflictDismissed(true)} className="text-amber-500 hover:text-amber-700">✕</button>
                    </div>
                  )}

                  {!drawnLine ? (
                    <Button
                      type="button"
                      className="w-full h-9 text-xs font-semibold gap-2"
                      variant={drawMode === 'line' ? 'default' : 'outline'}
                      onClick={handleStartDraw}
                    >
                      <Route className="h-4 w-4" />
                      {drawMode === 'line' ? 'جاري الرسم... انقر أو اضغط مرتين لإنهاء الخط' : 'ابدأ رسم المسار'}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <span>✓ المسار جاهز ({drawnLine.length} نقطة)</span>
                        <Button
                          type="button"
                          variant={drawMode === 'line' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setMode(drawMode === 'line' ? 'idle' : 'line')}
                          className="h-7 text-xs gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          {drawMode === 'line' ? 'إيقاف إضافة نقاط' : 'تعديل وتمديد الخط'}
                        </Button>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-snug">
                        • **التعديل**: اسحب أي نقطة حمراء على الخريطة مباشرة (تتحرك المحطات تلقائياً متبعةً الخط).<br />
                        • **إنهاء التعديل**: انقر مرتين أو اضغط مرتين (Double Tap) لإنهاء التعديل.<br />
                        • **الحذف**: انقر يميناً على أي نقطة للحذف.
                      </p>

                      <Button type="button" variant="ghost" size="sm" onClick={handleRedraw} className="w-full h-7 text-xs text-muted-foreground hover:text-destructive">
                        <RotateCcw className="h-3 w-3 ms-1" />
                        إعادة رسم المسار من جديد
                      </Button>
                    </div>
                  )}

                  {drawMode === 'line' && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-muted-foreground">{drawnLine?.length ?? activeVertexCount} نقطة مضافة</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={(drawnLine?.length ?? 0) === 0 && activeVertexCount === 0}
                        onClick={handleUndo}
                        className="h-7 text-xs gap-1"
                      >
                        <Undo2 className="h-3 w-3" />
                        تراجع عن النقطة
                      </Button>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Accordion 2: Bus Stops Tool */}
            <AccordionItem value="stops">
              <AccordionTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">أداة مواقف الحافلات</span>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 me-1">
                  {stops.length} محطة
                </Badge>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    انقر على الخريطة لوضع محطات الحافلات. تتحاذى وتتحرك المحطات تلقائياً على خط المسار.
                  </p>

                  <Button
                    type="button"
                    className="w-full h-9 text-xs font-semibold gap-2"
                    variant={drawMode === 'point' ? 'default' : 'outline'}
                    onClick={handleActivatePoint}
                  >
                    <MapPin className="h-4 w-4" />
                    {drawMode === 'point' ? 'جاري وضع المحطات... انقر على الخريطة' : 'إضافة محطات حافلات'}
                  </Button>

                  {stops.length > 0 ? (
                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-semibold text-foreground">المحطات المضافة ({stops.length}):</span>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pe-1">
                        {stops.map((stop, i) => (
                          <div
                            key={stop.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg border transition-colors ${
                              activeStopId === stop.id
                                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                : 'border-border bg-background'
                            }`}
                          >
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground shadow-xs">
                              {i + 1}
                            </span>
                            <Input
                              id={`stop-input-${stop.id}`}
                              type="text"
                              value={stop.nameAr}
                              onFocus={() => setActiveStopId(stop.id)}
                              onChange={(e) => updateStopName(stop.id, e.target.value)}
                              placeholder="اسم المحطة..."
                              className="h-7 text-xs flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStop(stop.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                              title="حذف المحطة"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-center text-muted-foreground py-2 border border-dashed rounded-lg">
                      لم تضف أي محطات بعد.
                    </p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Accordion 3: Color Selection */}
            <AccordionItem value="color">
              <AccordionTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <Palette className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">اختيار لون الخط</span>
                </div>
                <span
                  className="h-4 w-4 rounded-full border border-border shadow-xs shrink-0 me-1"
                  style={{ backgroundColor: getRouteColor(colorIndex) }}
                />
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    اختر اللون المميز لخط السرفيس أو الحافلة على الخريطة التفاعلية:
                  </p>

                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {ROUTE_PALETTE.map((colorHex, idx) => {
                      const isSelected = colorIndex === idx;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setColorIndex(idx)}
                          className={`relative flex h-8 w-full items-center justify-center rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'scale-105 border-primary ring-2 ring-primary/30 shadow-md'
                              : 'border-transparent opacity-80 hover:opacity-100 hover:scale-105'
                          }`}
                          style={{ backgroundColor: colorHex }}
                          title={`لون ${idx + 1}`}
                        >
                          {isSelected && <Check className="h-4 w-4 text-white drop-shadow-md" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Accordion 4: Details */}
            <AccordionItem value="details">
              <AccordionTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-semibold">بيانات وتفاصيل المسار</span>
                </div>
                {nameAr.trim() ? (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 me-1">
                    مكتمل
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] shrink-0 me-1">
                    مطلوب
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      اسم المسار بالعربية <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="text"
                      required
                      value={nameAr}
                      onChange={(e) => setMeta({ nameAr: e.target.value })}
                      placeholder="مثال: باب توما — برامكة"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      الاسم بالإنجليزية (اختياري)
                    </label>
                    <Input
                      type="text"
                      value={nameEn}
                      onChange={(e) => setMeta({ nameEn: e.target.value })}
                      placeholder="e.g. Bab Touma — Baramkeh"
                      dir="ltr"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      التعرفة / سعر التذكرة (ل.س - اختياري)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={price}
                      onChange={(e) => setMeta({ price: e.target.value })}
                      placeholder="مثال: 1500"
                      dir="ltr"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      ملاحظات إضافية (اختياري)
                    </label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setMeta({ notes: e.target.value })}
                      placeholder="محطات بارزة، جداول التشغيل، تفاصيل إضافية..."
                      rows={2}
                      className="text-xs resize-none"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Accordion 5: Submission & Credit Options */}
            <AccordionItem value="submission">
              <AccordionTrigger>
                <div className="flex items-center gap-2 min-w-0">
                  <Send className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate font-semibold">إرسال المسودة والتسليم</span>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0 me-1">
                  جاهز
                </Badge>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3">
                  {/* Summary Details Card */}
                  <div className="p-2.5 rounded-lg border border-border bg-muted/30 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">المدينة:</span>
                      <span className="font-semibold text-foreground">{currentCity?.nameAr}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">اسم المسار:</span>
                      <span className="font-semibold text-foreground">{nameAr || 'غير محدد'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نقاط الخط:</span>
                      <span className="font-semibold text-foreground">{drawnLine?.length ?? 0} نقطة</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">عدد المحطات:</span>
                      <span className="font-semibold text-foreground">{stops.length} محطة</span>
                    </div>
                  </div>

                  {!user ? (
                    <div className="space-y-2.5 pt-1">
                      <div className="p-2.5 bg-accent/40 rounded-lg border border-border text-xs space-y-1.5">
                        <p className="font-semibold text-foreground">خيارات الإرسال:</p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          يمكنك إرسال المسودة فوراً كزائر (مجهول)، أو تسجيل الدخول بحساب Google لتُنسب المساهمة لك وتتمكن من متابعة وتعديل المسار لاحقاً.
                        </p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        disabled={submitting || !nameAr.trim() || !drawnLine}
                        variant="outline"
                        className="w-full h-9 text-xs font-semibold gap-2 border-primary/40 hover:bg-primary/5"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 text-primary" />
                        )}
                        إرسال كزائر (مجهول)
                      </Button>

                      <Button
                        type="button"
                        onClick={() => handleSubmit(true)}
                        disabled={submitting || !nameAr.trim() || !drawnLine}
                        className="w-full h-9 text-xs font-bold gap-2"
                      >
                        <Sparkles className="h-4 w-4" />
                        تسجيل الدخول وإرسال (حفظ المساهمة باسمي)
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                        <UserCheck className="w-4 h-4 text-primary" />
                        <span className="font-bold text-primary">مسجل باسم:</span>
                        <span className="truncate font-semibold text-foreground">{user.name}</span>
                      </div>

                      <Button
                        type="button"
                        onClick={() => handleSubmit(false)}
                        disabled={submitting || !nameAr.trim() || !drawnLine}
                        className="w-full h-9 text-xs font-bold gap-2"
                      >
                        {submitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        {isEditMode ? 'تحديث المسودة باسمي' : 'إرسال المسودة باسمي'}
                      </Button>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="w-full h-8 text-xs text-muted-foreground hover:text-destructive"
                  >
                    إعادة ضبط المسودة
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}
    </div>
  )

  return (
    <div dir="rtl" className="studio-root min-h-screen bg-background text-foreground font-sans">
      <Head title="استوديو ترانزيت | رسم الخرائط" />

      {/* Stacked Shadcn Sonner Toaster */}
      <Toaster position="bottom-left" richColors />

      {/* Full-screen Body Container (Clean layout without top header) */}
      <div className="studio-body relative flex h-screen overflow-hidden">
        {/* Desktop Sidebar (hidden on mobile, visible on md+) */}
        <aside className="hidden md:flex studio-sidebar w-80 md:w-96 border-e border-border bg-card shrink-0 flex-col z-20">
          {sidebarControlsContent}
        </aside>

        {/* Mobile Resizable Bottom Sheet Drawer (visible on mobile, hidden on md+) */}
        <BottomSheet
          storageKey="transit:studio:sheet-height"
          initialHeight={340}
          className="md:hidden border-t border-border shadow-2xl z-30"
        >
          {sidebarControlsContent}
        </BottomSheet>

        {/* Map Container */}
        <div className="studio-map-wrapper flex-1 relative h-full">
          {!mapReady && (
            <div className="studio-map-loader absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="text-xs font-semibold text-muted-foreground">تحميل الخريطة التفاعلية...</span>
            </div>
          )}
          <div ref={mapContainer} className="studio-map w-full h-full" />

          {drawMode !== 'idle' && (
            <div className="absolute top-4 start-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/95 border border-border shadow-lg text-xs font-semibold text-foreground animate-in fade-in">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              {drawMode === 'line'  && '✏ وضع رسم وتمديد الخط — انقر مرتين أو اضغط مرتين لإنهاء التعديل'}
              {drawMode === 'point' && '📍 وضع إضافة المحطات — انقر لوضع محطة (تتحاذى وتتحرك على الخط)'}
            </div>
          )}

          {drawMode === 'line' && activeVertexCount >= 2 && (
            <button
              type="button"
              className="absolute bottom-16 md:bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-20 flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-xs shadow-2xl hover:scale-105 transition-all"
              onClick={finishLineEditing}
            >
              <Check className="w-4 h-4" />
              إكمال وإنهاء رسم المسار ({activeVertexCount} نقطة)
            </button>
          )}

          {activeStop && activeStopPixel && (
            <StopNamePopup
              stop={activeStop}
              pixel={activeStopPixel}
              onConfirm={handleConfirmStopName}
              onDismiss={handleDismissStopPopup}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function TransitStudioPage() {
  return (
    <TransitLayout>
      <TransitStudioPageContent />
    </TransitLayout>
  )
}
