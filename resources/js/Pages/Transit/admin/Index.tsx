'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import { useAdminDrafts, useMapData } from '../_hooks/useMapData'
import { useQueryClient } from '@tanstack/react-query'
import { router, Head } from '@inertiajs/react'
import { useTransitTheme } from '../_components/TransitThemeContext'
import { ROUTE_PALETTE, getRouteColor, buildColorMatch } from '../_lib/mapColors'
import TransitLayout from '../layout'
import { Button } from '@/Components/ui/button'
import { Badge } from '@/Components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/Components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/Components/ui/tabs'
import { Input } from '@/Components/ui/input'
import { Textarea } from '@/Components/ui/textarea'
import { ScrollArea } from '@/Components/ui/scroll-area'
import { Separator } from '@/Components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/Components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/Components/ui/dialog'
import {
  ArrowRight, MapPin, CheckCircle2, XCircle, Eye, EyeOff,
  GitMerge, GitBranch, MoveRight, LogOut, Map, Loader2,
  Route, Users, History, Pencil
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type DraftStatus = 'pending' | 'approved' | 'rejected'
type RouteStatus = 'published' | 'disapproved' | 'hidden'

interface Draft {
  id: number
  user_id: number
  user: { name: string } | null
  route_id: string | null
  linked_route: { name_ar: string; name_en: string } | null
  city_id: string
  city: { name_ar: string; name_en: string } | null
  name_ar: string
  name_en: string | null
  price: number | null
  notes: string | null
  geojson: any
  status: DraftStatus
  rejection_reason: string | null
  created_at: string
}

interface PublishedRoute {
  id: string
  city_id: string
  city: { name_ar: string; name_en: string } | null
  name_ar: string
  name_en: string | null
  color_index?: number
  price_old: number | null
  price_new: number | null
  status: RouteStatus
  stops_count: number
  created_at: string
}

interface ActivityLog {
  id: number
  route_id: string | null
  action: string
  description: string
  user: { name: string } | null
  created_at: string
}

const STATUS_LABELS: Record<DraftStatus, string> = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
}

const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  published: 'منشور',
  disapproved: 'معطل',
  hidden: 'مخفي',
}

function getCsrfToken(): string {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

function stopCount(draft: Draft) {
  let geojson = draft.geojson
  if (typeof geojson === 'string') {
    try { geojson = JSON.parse(geojson) } catch { /* */ }
  }
  return geojson?.features?.filter((f: any) => f.geometry?.type === 'Point').length ?? 0
}

function LogIcon({ action }: { action: string }) {
  switch (action) {
    case 'approved': return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    case 'disapproved': return <XCircle className="h-3.5 w-3.5 text-red-500" />
    case 'restored': return <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
    case 'hidden': return <EyeOff className="h-3.5 w-3.5 text-zinc-500" />
    case 'combined': return <GitMerge className="h-3.5 w-3.5 text-purple-500" />
    case 'split': return <GitBranch className="h-3.5 w-3.5 text-pink-500" />
    case 'moved': return <MoveRight className="h-3.5 w-3.5 text-teal-500" />
    default: return <History className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
function TransitAdminPageContent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const { theme } = useTransitTheme()
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  const [adminTab, setAdminTab] = useState<string>('drafts')

  const [publishedRoutes, setPublishedRoutes] = useState<PublishedRoute[]>([])
  const [loadingRoutes, setLoadingRoutes] = useState(false)
  const [selectedRoute, setSelectedRoute] = useState<PublishedRoute | null>(null)
  const [selectedRouteGeoJson, setSelectedRouteGeoJson] = useState<any>(null)
  const [routeSearchQuery, setRouteSearchQuery] = useState('')
  const [routeCityFilter, setRouteCityFilter] = useState('all')
  const [routeStatusFilter, setRouteStatusFilter] = useState<string>('all')
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [cities, setCities] = useState<any[]>([])

  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false)
  const [combineCityId, setCombineCityId] = useState('')
  const [combineRouteAId, setCombineRouteAId] = useState('')
  const [combineRouteBId, setCombineRouteBId] = useState('')
  const [combineNameAr, setCombineNameAr] = useState('')
  const [combineNameEn, setCombineNameEn] = useState('')
  const [combinePrice, setCombinePrice] = useState('')

  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false)
  const [splitAtStopId, setSplitAtStopId] = useState('')
  const [splitNameAAr, setSplitNameAAr] = useState('')
  const [splitNameAEn, setSplitNameAEn] = useState('')
  const [splitNameBAr, setSplitNameBAr] = useState('')
  const [splitNameBEn, setSplitNameBEn] = useState('')
  const [routeStops, setRouteStops] = useState<any[]>([])

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false)
  const [targetCityId, setTargetCityId] = useState('')

  const [isEditRouteModalOpen, setIsEditRouteModalOpen] = useState(false)
  const [editRouteNameAr, setEditRouteNameAr] = useState('')
  const [editRouteNameEn, setEditRouteNameEn] = useState('')
  const [editRoutePrice, setEditRoutePrice] = useState('')
  const [editRouteColorIndex, setEditRouteColorIndex] = useState<number>(0)
  const [approveColorIndex, setApproveColorIndex] = useState<number>(0)

  const queryClient = useQueryClient()
  const { data: drafts = [], isLoading, error: draftsError } = useAdminDrafts()

  const activeCityId = adminTab === 'drafts' ? selectedDraft?.city_id : selectedRoute?.city_id
  const { data: refData, refetch: refetchRefData } = useMapData(activeCityId)

  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }, [])

  useEffect(() => {
    fetch('/api/v1/cities').then(r => r.json()).then(setCities).catch(() => {})
  }, [])

  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true)
    try {
      const res = await fetch('/api/v1/admin/routes')
      if (res.ok) setPublishedRoutes(await res.json())
    } catch { /* */ } finally { setLoadingRoutes(false) }
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/v1/admin/routes/logs')
      if (res.ok) setLogs(await res.json())
    } catch { /* */ } finally { setLoadingLogs(false) }
  }, [])

  // ─── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: theme === 'jasmine' ? '/styles/styles/positron.json' : '/styles/styles/dark-matter.json',
      center: [36.29, 33.51],
      zoom: 7,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')
    map.on('load', () => {
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
      map.addSource('ref-routes', { type: 'geojson', data: empty })
      map.addSource('ref-stops', { type: 'geojson', data: empty })
      map.addLayer({ id: 'ref-layer-routes', type: 'line', source: 'ref-routes', paint: { 'line-color': buildColorMatch() as any, 'line-width': 3, 'line-opacity': 0.45 } })
      map.addLayer({ id: 'ref-layer-routes-hit', type: 'line', source: 'ref-routes', paint: { 'line-width': 16, 'line-opacity': 0 } })
      map.addLayer({ id: 'ref-layer-stops', type: 'circle', source: 'ref-stops', paint: { 'circle-radius': 4, 'circle-color': '#c8963a', 'circle-opacity': 0.35 } })
      
      map.addSource('draft-source', { type: 'geojson', data: empty })
      map.addLayer({
        id: 'draft-line', type: 'line', source: 'draft-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#c8963a', 'line-width': 5, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'draft-points', type: 'circle', source: 'draft-source',
        paint: { 'circle-radius': 5, 'circle-color': '#c44b4b', 'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff' },
        filter: ['==', '$type', 'Point'],
      })
      map.resize()
      mapRef.current = map
      setMapReady(true)
    })
    return () => { map.remove(); mapRef.current = null; setMapReady(false) }
  }, [theme])

function getGeoJsonBounds(geojson: any): maplibregl.LngLatBounds | null {
  if (!geojson) return null
  const coords: [number, number][] = []

  const extractCoords = (geom: any) => {
    if (!geom || !geom.coordinates) return
    const { type, coordinates } = geom
    if (type === 'Point') {
      coords.push(coordinates as [number, number])
    } else if (type === 'LineString' || type === 'MultiPoint') {
      coordinates.forEach((c: any) => coords.push(c as [number, number]))
    } else if (type === 'MultiLineString' || type === 'Polygon') {
      coordinates.forEach((line: any) => line.forEach((c: any) => coords.push(c as [number, number])))
    } else if (type === 'MultiPolygon') {
      coordinates.forEach((poly: any) => poly.forEach((line: any) => line.forEach((c: any) => coords.push(c as [number, number]))))
    }
  }

  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    geojson.features.forEach((f: any) => extractCoords(f.geometry))
  } else if (geojson.type === 'Feature') {
    extractCoords(geojson.geometry)
  } else {
    extractCoords(geojson)
  }

  if (coords.length === 0) return null
  const bounds = new maplibregl.LngLatBounds(coords[0], coords[0])
  coords.forEach(c => bounds.extend(c as maplibregl.LngLatLike))
  return bounds
}

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('draft-source') as maplibregl.GeoJSONSource | undefined
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    let geojsonData: any = empty
    if (adminTab === 'drafts') {
      geojsonData = selectedDraft?.geojson ?? empty
      if (typeof geojsonData === 'string') { try { geojsonData = JSON.parse(geojsonData) } catch { geojsonData = empty } }
    } else if (adminTab === 'routes') {
      geojsonData = selectedRouteGeoJson ?? empty
    }
    src?.setData(geojsonData)

    const bounds = getGeoJsonBounds(geojsonData)
    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 })
    }
  }, [mapReady, selectedDraft, selectedRouteGeoJson, adminTab])

  // Update line color, casing, points, and background dimming dynamically
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    let color = '#c8963a'
    if (adminTab === 'drafts' && selectedDraft) {
      color = getRouteColor(approveColorIndex)
    } else if (adminTab === 'routes' && selectedRoute) {
      color = getRouteColor(selectedRoute.color_index ?? 0)
    }

    if (map.getLayer('draft-line')) {
      map.setPaintProperty('draft-line', 'line-color', color)
      map.setPaintProperty('draft-line', 'line-width', 5)
      map.setPaintProperty('draft-line', 'line-opacity', 0.9)
    }
    if (map.getLayer('draft-points')) {
      map.setPaintProperty('draft-points', 'circle-color', color)
    }

    if (map.getLayer('ref-layer-routes')) {
      const isSelected = (adminTab === 'drafts' && !!selectedDraft) || (adminTab === 'routes' && !!selectedRoute)
      map.setPaintProperty('ref-layer-routes', 'line-opacity', isSelected ? 0.15 : 0.45)
      map.setPaintProperty('ref-layer-routes', 'line-width', 3)
    }
  }, [mapReady, adminTab, approveColorIndex, selectedRoute, selectedDraft])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    ;(mapRef.current.getSource('ref-routes') as maplibregl.GeoJSONSource | undefined)?.setData((refData?.routes ?? empty) as any)
    ;(mapRef.current.getSource('ref-stops') as maplibregl.GeoJSONSource | undefined)?.setData((refData?.stops ?? empty) as any)
  }, [mapReady, refData])

  useEffect(() => {
    if (mobileView === 'map') setTimeout(() => mapRef.current?.resize(), 60)
  }, [mobileView])

  // ─── API Handlers ─────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (id: number, colorIndex?: number) => {
    setActionLoading(true)
    const selectedColor = colorIndex ?? approveColorIndex
    try {
      const res = await fetch(`/api/v1/admin/route-drafts/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ color_index: selectedColor }),
      })
      if (res.ok) {
        showToast('تمت الموافقة على المسار ونشره')
        setSelectedDraft(null)
        queryClient.invalidateQueries({ queryKey: ['admin-drafts'] })
        queryClient.invalidateQueries({ queryKey: ['mapData'] })
        queryClient.invalidateQueries({ queryKey: ['routes'] })
      }
      else { const e = await res.json().catch(() => ({})); showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false) }
    } catch { showToast('تعذّر الاتصال بالخادم', false) } finally { setActionLoading(false) }
  }, [approveColorIndex, showToast, queryClient])

  const handleRejectConfirm = useCallback(async () => {
    if (!selectedDraft) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/route-drafts/${selectedDraft.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectReason.trim() || null }),
      })
      if (res.ok) { showToast('تم رفض المسار'); setSelectedDraft(null); setRejectOpen(false); setRejectReason('') }
      else { const e = await res.json().catch(() => ({})); showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false) }
    } catch { showToast('تعذّر الاتصال بالخادم', false) } finally { setActionLoading(false) }
  }, [selectedDraft, rejectReason, showToast])

  const handleSelectRoute = useCallback(async (route: PublishedRoute) => {
    setSelectedRoute(route)
    setMobileView('map')

    // 1. Zoom in immediately using memory geometry from refData if present
    const featureFromRef = refData?.routes?.features?.find((f: any) => String(f.properties?.id) === String(route.id))
    if (featureFromRef) {
      const geojson = { type: 'FeatureCollection', features: [featureFromRef] }
      setSelectedRouteGeoJson(geojson)
      if (mapRef.current) {
        const bounds = getGeoJsonBounds(geojson)
        if (bounds) mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 })
      }
    }

    // 2. Fetch full GeoJSON (with stops) from server
    try {
      const res = await fetch(`/api/v1/admin/routes/${route.id}/geojson`)
      if (res.ok) {
        const fullGeojson = await res.json()
        setSelectedRouteGeoJson(fullGeojson)
        if (mapRef.current) {
          const bounds = getGeoJsonBounds(fullGeojson)
          if (bounds) mapRef.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 800 })
        }
      }
    } catch { /* */ }
  }, [refData])

  const handleUpdateStatus = useCallback(async (routeId: string, newStatus: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/routes/${routeId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) { showToast('تم تحديث حالة الخط'); fetchRoutes(); if (selectedRoute?.id === routeId) setSelectedRoute(p => p ? { ...p, status: newStatus as RouteStatus } : null) }
      else { const e = await res.json().catch(() => ({})); showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false) }
    } catch { showToast('تعذّر الاتصال بالخادم', false) } finally { setActionLoading(false) }
  }, [fetchRoutes, selectedRoute, showToast])

  const handleMoveRoute = useCallback(async () => {
    if (!selectedRoute) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/routes/${selectedRoute.id}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ city_id: targetCityId }),
      })
      if (res.ok) { showToast('تم نقل الخط'); setIsMoveModalOpen(false); setSelectedRoute(null); setSelectedRouteGeoJson(null); fetchRoutes() }
      else { const e = await res.json().catch(() => ({})); showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false) }
    } catch { showToast('تعذّر الاتصال بالخادم', false) } finally { setActionLoading(false) }
  }, [selectedRoute, targetCityId, fetchRoutes, showToast])

  const handleCombineRoutes = useCallback(async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/v1/admin/routes/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ route_a_id: combineRouteAId, route_b_id: combineRouteBId, name_ar: combineNameAr.trim(), name_en: combineNameEn.trim() || null, price: combinePrice ? parseInt(combinePrice) : null }),
      })
      if (res.ok) { showToast('تم دمج الخطين'); setIsCombineModalOpen(false); setCombineRouteAId(''); setCombineRouteBId(''); setCombineNameAr(''); setCombineNameEn(''); setCombinePrice(''); fetchRoutes() }
      else { const e = await res.json().catch(() => ({})); showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false) }
    } catch { showToast('تعذّر الاتصال بالخادم', false) } finally { setActionLoading(false) }
  }, [combineRouteAId, combineRouteBId, combineNameAr, combineNameEn, combinePrice, fetchRoutes, showToast])

  const handleSplitRoute = useCallback(async () => {
    if (!selectedRoute) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/v1/admin/routes/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ route_id: selectedRoute.id, split_stop_id: splitAtStopId, name_a_ar: splitNameAAr.trim(), name_a_en: splitNameAEn.trim() || null, name_b_ar: splitNameBAr.trim(), name_b_en: splitNameBEn.trim() || null }),
      })
      if (res.ok) { showToast('تم تقسيم الخط'); setIsSplitModalOpen(false); setSelectedRoute(null); setSelectedRouteGeoJson(null); fetchRoutes() }
      else { const e = await res.json().catch(() => ({})); showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false) }
    } catch { showToast('تعذّر الاتصال بالخادم', false) } finally { setActionLoading(false) }
  }, [selectedRoute, splitAtStopId, splitNameAAr, splitNameAEn, splitNameBAr, splitNameBEn, fetchRoutes, showToast])

  const handleUpdateRoute = useCallback(async () => {
    if (!selectedRoute) return
    setActionLoading(true)
    let success = false
    try {
      const res = await fetch(`/api/v1/admin/routes/${selectedRoute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({
          name_ar: editRouteNameAr.trim() || undefined,
          name_en: editRouteNameEn.trim() || null,
          color_index: editRouteColorIndex,
          price_new: editRoutePrice ? parseInt(editRoutePrice) : null,
        }),
      })
      if (res.ok) {
        success = true
      } else {
        const e = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false)
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setActionLoading(false)
    }

    if (success) {
      showToast('تم تحديث الخط')
      setIsEditRouteModalOpen(false)
      const updatedRoute = {
        ...selectedRoute,
        name_ar: editRouteNameAr.trim() || selectedRoute.name_ar,
        name_en: editRouteNameEn.trim() || null,
        color_index: editRouteColorIndex,
        price_new: editRoutePrice ? parseInt(editRoutePrice) : selectedRoute.price_new,
      }
      setSelectedRoute(updatedRoute)
      setPublishedRoutes(prev => prev.map(r => r.id === selectedRoute.id ? { ...r, color_index: editRouteColorIndex, name_ar: editRouteNameAr.trim() || r.name_ar } : r))

      try {
        const resGeo = await fetch(`/api/v1/admin/routes/${selectedRoute.id}/geojson`)
        if (resGeo.ok) setSelectedRouteGeoJson(await resGeo.json())
      } catch { /* */ }

      queryClient.invalidateQueries({ queryKey: ['mapData'] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      try { refetchRefData?.() } catch { /* */ }
      try { fetchRoutes() } catch { /* */ }
    }
  }, [selectedRoute, editRouteNameAr, editRouteNameEn, editRouteColorIndex, editRoutePrice, fetchRoutes, showToast, queryClient, refetchRefData])

  const handleQuickUpdateColor = useCallback(async (newColorIndex: number) => {
    if (!selectedRoute) return
    setActionLoading(true)
    let success = false
    try {
      const res = await fetch(`/api/v1/admin/routes/${selectedRoute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        credentials: 'include',
        body: JSON.stringify({ color_index: newColorIndex }),
      })
      if (res.ok) {
        success = true
      } else {
        const e = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (e.message ?? `HTTP ${res.status}`), false)
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setActionLoading(false)
    }

    if (success) {
      showToast('تم تحديث لون الخط')
      const updatedRoute = { ...selectedRoute, color_index: newColorIndex }
      setSelectedRoute(updatedRoute)
      setPublishedRoutes(prev => prev.map(r => r.id === selectedRoute.id ? { ...r, color_index: newColorIndex } : r))

      // Update active geojson properties in state immediately so map reflects color
      setSelectedRouteGeoJson((prev: any) => {
        if (!prev) return null
        return {
          ...prev,
          features: (prev.features || []).map((f: any) => ({
            ...f,
            properties: { ...f.properties, colorIndex: newColorIndex, color_index: newColorIndex }
          }))
        }
      })

      if (mapRef.current?.getLayer('draft-line')) {
        mapRef.current.setPaintProperty('draft-line', 'line-color', getRouteColor(newColorIndex))
      }
      if (mapRef.current?.getLayer('draft-points')) {
        mapRef.current.setPaintProperty('draft-points', 'circle-color', getRouteColor(newColorIndex))
      }

      queryClient.invalidateQueries({ queryKey: ['mapData'] })
      queryClient.invalidateQueries({ queryKey: ['routes'] })
      try { refetchRefData?.() } catch { /* */ }
      try { fetchRoutes() } catch { /* */ }
    }
  }, [selectedRoute, fetchRoutes, showToast, queryClient, refetchRefData])

  // ─── Derived ──────────────────────────────────────────────────────────────
  const stats = {
    pending: drafts.filter((d: Draft) => d.status === 'pending').length,
    approved: drafts.filter((d: Draft) => d.status === 'approved').length,
    rejected: drafts.filter((d: Draft) => d.status === 'rejected').length,
  }
  const uniqueCities = [...new Set(drafts.map((d: Draft) => d.city_id))]
  const filteredDrafts = drafts
    .filter((d: Draft) => statusFilter === 'all' || d.status === statusFilter)
    .filter((d: Draft) => cityFilter === 'all' || d.city_id === cityFilter)
    .sort((a: Draft, b: Draft) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const filteredRoutes = publishedRoutes
    .filter(r => routeStatusFilter === 'all' || r.status === routeStatusFilter)
    .filter(r => routeCityFilter === 'all' || r.city_id === routeCityFilter)
    .filter(r => {
      const q = routeSearchQuery.trim().toLowerCase()
      if (!q) return true
      return r.name_ar.toLowerCase().includes(q) || (r.name_en?.toLowerCase() || '').includes(q)
    })

  return (
    <>
    <div className="h-full overflow-hidden flex flex-col lg:flex-row bg-background text-foreground" dir="rtl">
      {/* Sidebar */}
      <aside className="w-full lg:w-[400px] xl:w-[440px] flex-shrink-0 flex flex-col border-l border-border bg-card overflow-hidden max-h-full">
        <header className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h1 className="text-lg font-bold text-foreground">لوحة إدارة النقل</h1>
            <p className="text-xs text-muted-foreground mt-0.5">إدارة ومراجعة خطوط النقل</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => router.post('/logout')} title="تسجيل الخروج">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <Tabs value={adminTab} onValueChange={(v) => {
          setAdminTab(v)
          if (v === 'drafts') { setSelectedRoute(null); setSelectedRouteGeoJson(null) }
          if (v === 'routes') { setSelectedDraft(null); fetchRoutes() }
          if (v === 'logs') { setSelectedDraft(null); setSelectedRoute(null); setSelectedRouteGeoJson(null); fetchLogs() }
        }} className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="mx-4 mt-3" dir="rtl">
            <TabsTrigger value="drafts" className="flex-1 text-xs gap-1.5">
              <Users className="h-3.5 w-3.5" /> المسودات
            </TabsTrigger>
            <TabsTrigger value="routes" className="flex-1 text-xs gap-1.5">
              <Route className="h-3.5 w-3.5" /> الخطوط
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex-1 text-xs gap-1.5">
              <History className="h-3.5 w-3.5" /> السجل
            </TabsTrigger>
          </TabsList>

          {/* ── DRAFTS TAB ─────────────────────────────────────────────── */}
          <TabsContent value="drafts" className="flex-1 flex flex-col overflow-hidden mt-0">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 px-4 pt-3">
              <Card className="py-2 text-center"><CardContent className="p-1"><span className="text-xl font-bold text-amber-500">{stats.pending}</span><p className="text-[10px] text-muted-foreground">بانتظار المراجعة</p></CardContent></Card>
              <Card className="py-2 text-center"><CardContent className="p-1"><span className="text-xl font-bold text-green-500">{stats.approved}</span><p className="text-[10px] text-muted-foreground">مقبول</p></CardContent></Card>
              <Card className="py-2 text-center"><CardContent className="p-1"><span className="text-xl font-bold text-red-500">{stats.rejected}</span><p className="text-[10px] text-muted-foreground">مرفوض</p></CardContent></Card>
            </div>

            {/* Filters */}
            <div className="px-4 pt-3 space-y-2">
              <div className="flex gap-1.5">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                  <Badge key={s} variant={statusFilter === s ? 'default' : 'outline'} className="cursor-pointer text-[10px] px-2" onClick={() => setStatusFilter(s)}>
                    {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
                  </Badge>
                ))}
              </div>
              {uniqueCities.length > 1 && (
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="جميع المدن" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع المدن</SelectItem>
                    {uniqueCities.map(id => <SelectItem key={id} value={id}>{id}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Separator className="my-2" />

            {/* List */}
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-2 pb-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin ms-2" /> جاري التحميل…</div>
                ) : draftsError ? (
                  <div className="text-center py-8 text-destructive text-sm">تعذّر تحميل البيانات</div>
                ) : filteredDrafts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">لا توجد نتائج</div>
                ) : filteredDrafts.map(draft => (
                  <div key={draft.id} role="button" tabIndex={0}
                    className={`w-full text-right p-3 rounded-lg border transition-colors cursor-pointer ${selectedDraft?.id === draft.id ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}
                    onClick={() => { setSelectedDraft(draft); setMobileView('map') }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setSelectedDraft(draft); setMobileView('map') } }}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight">{draft.name_ar}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {draft.route_id && (
                          <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-300">
                            تعديل مقترح
                          </Badge>
                        )}
                        <Badge variant={draft.status === 'pending' ? 'secondary' : draft.status === 'approved' ? 'default' : 'destructive'} className="text-[10px]">
                          {STATUS_LABELS[draft.status]}
                        </Badge>
                        <button
                          type="button"
                          className="p-1 rounded-md hover:bg-muted transition-colors"
                          title="تعديل في الاستوديو"
                          onClick={(e) => { e.stopPropagation(); router.get(`/transit/studio?edit=${draft.id}`) }}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                      <span>{draft.city?.name_ar ?? draft.city_id}</span>
                      <span>·</span>
                      <span>{draft.user?.name ?? 'مجهول'}</span>
                      <span>·</span>
                      <span>{stopCount(draft)} محطة</span>
                      <span>·</span>
                      <span>{new Date(draft.created_at).toLocaleDateString('ar-SY')}</span>
                    </div>
                    {draft.status === 'rejected' && draft.rejection_reason && (
                      <p className="text-[11px] text-destructive mt-1 italic">{draft.rejection_reason}</p>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── ROUTES TAB ─────────────────────────────────────────────── */}
          <TabsContent value="routes" className="flex-1 flex flex-col overflow-hidden mt-0">
            {/* Quick Actions */}
            <div className="px-4 pt-3">
              <Button variant="default" size="sm" className="w-full text-xs gap-1.5" onClick={() => { setCombineCityId(''); setCombineRouteAId(''); setCombineRouteBId(''); setCombineNameAr(''); setCombineNameEn(''); setCombinePrice(''); setIsCombineModalOpen(true) }}>
                <GitMerge className="h-3.5 w-3.5" /> دمج خطين
              </Button>
            </div>

            {/* Filters */}
            <div className="px-4 pt-3 space-y-2">
              <Input placeholder="بحث باسم الخط..." value={routeSearchQuery} onChange={e => setRouteSearchQuery(e.target.value)} className="h-8 text-xs" />
              <div className="flex gap-1.5">
                {(['all', 'published', 'disapproved', 'hidden'] as const).map(s => (
                  <Badge key={s} variant={routeStatusFilter === s ? 'default' : 'outline'} className="cursor-pointer text-[10px] px-2" onClick={() => setRouteStatusFilter(s)}>
                    {s === 'all' ? 'الكل' : ROUTE_STATUS_LABELS[s]}
                  </Badge>
                ))}
              </div>
              <Select value={routeCityFilter} onValueChange={setRouteCityFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="جميع المدن" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع المدن</SelectItem>
                  {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Separator className="my-2" />

            <ScrollArea className="flex-1 px-4">
              <div className="space-y-2 pb-4">
                {loadingRoutes ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin ms-2" /> جاري التحميل…</div>
                ) : filteredRoutes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">لا توجد خطوط مطابقة</div>
                ) : filteredRoutes.map(route => (
                  <div key={route.id} role="button" tabIndex={0}
                    className={`w-full max-w-full box-border text-right p-3 rounded-lg border transition-colors cursor-pointer ${selectedRoute?.id === route.id ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}
                    onClick={() => handleSelectRoute(route)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectRoute(route) }}>
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-3 h-3 rounded-full shrink-0 border border-black/10 shadow-xs" style={{ backgroundColor: getRouteColor(route.color_index ?? 0) }} title={`لون المسار ${((route.color_index ?? 0) % 8) + 1}`} />
                        <span className="text-sm font-semibold leading-tight truncate">{route.name_ar}</span>
                      </div>
                      <Badge variant={route.status === 'published' ? 'default' : route.status === 'disapproved' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                        {ROUTE_STATUS_LABELS[route.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                      <span>{route.city?.name_ar ?? route.city_id}</span>
                      <span>·</span>
                      <span>{route.stops_count} موقف</span>
                      {route.price_new && <><span>·</span><span className="text-primary font-semibold">{route.price_new} ل.س</span></>}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ── LOGS TAB ───────────────────────────────────────────────── */}
          <TabsContent value="logs" className="flex-1 flex flex-col overflow-hidden mt-0">
            <ScrollArea className="flex-1 px-4 pt-3">
              <div className="space-y-2 pb-4">
                {loadingLogs ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin ms-2" /> جاري التحميل…</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد سجل عمليات</div>
                ) : logs.map(log => (
                  <Card key={log.id} className="py-3">
                    <CardContent className="p-0 px-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LogIcon action={log.action} />
                          <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(log.created_at).toLocaleString('ar-SY')}</span>
                      </div>
                      <p className="text-xs mt-1.5 leading-relaxed">{log.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">المسؤول: {log.user?.name ?? 'مجهول'}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </aside>

      {/* Map panel — always rendered so MapLibre has real dimensions on init */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div ref={mapContainer} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Draft detail overlay */}
        {selectedDraft && adminTab === 'drafts' && (
          <Card className="absolute bottom-4 left-4 z-10 w-[360px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto shadow-2xl bg-card/95 backdrop-blur-sm" dir="rtl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{selectedDraft.name_ar}</CardTitle>
                  {selectedDraft.name_en && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{selectedDraft.name_en}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedDraft(null)}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">المدينة</span><p className="font-medium">{selectedDraft.city?.name_ar ?? selectedDraft.city_id}</p></div>
                <div><span className="text-muted-foreground">المساهم</span><p className="font-medium">{selectedDraft.user?.name ?? 'مجهول'}</p></div>
                <div><span className="text-muted-foreground">التعرفة</span><p className="font-medium">{selectedDraft.price ? `${selectedDraft.price} ل.س` : 'غير محدد'}</p></div>
                <div><span className="text-muted-foreground">المحطات</span><p className="font-medium">{stopCount(selectedDraft)} محطة</p></div>
              </div>
              {selectedDraft.route_id && (
                <div className="bg-blue-500/10 border border-blue-300 rounded-lg px-3 py-2 text-xs">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">تعديل مقترح للخط:</span>{' '}
                  <span className="font-medium">{selectedDraft.linked_route?.name_ar ?? selectedDraft.route_id}</span>
                </div>
              )}
              {selectedDraft.notes && <p className="text-xs text-muted-foreground border-t border-border pt-2">{selectedDraft.notes}</p>}
              <p className="text-[10px] text-muted-foreground text-center">الخطوط الباهتة = البيانات المنشورة. الخط اللامع = المسار المقترح.</p>

              {selectedDraft.status === 'pending' && (
                <div className="space-y-2 pt-1 border-t border-border/50">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-muted-foreground block">اختيار لون الخط على الخريطة:</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ROUTE_PALETTE.map((colorHex, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setApproveColorIndex(idx)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${approveColorIndex === idx ? 'scale-110 border-foreground shadow-md ring-2 ring-primary/40' : 'border-transparent opacity-75 hover:opacity-100'}`}
                          style={{ backgroundColor: colorHex }}
                          title={`لون ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button className="flex-1" size="sm" disabled={actionLoading} onClick={() => handleApprove(selectedDraft.id, approveColorIndex)}>
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {selectedDraft.route_id ? 'تطبيق التعديلات' : 'موافقة ونشر'}
                    </Button>
                    <Button variant="destructive" size="sm" className="flex-1" disabled={actionLoading} onClick={() => { setRejectReason(''); setRejectOpen(true) }}>
                      <XCircle className="h-4 w-4" /> رفض
                    </Button>
                  </div>
                </div>
              )}

              {selectedDraft.status !== 'pending' && (
                <>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => router.get(`/transit/studio?edit=${selectedDraft.id}`)}>
                      <Pencil className="h-3.5 w-3.5" /> تعديل في الاستوديو
                    </Button>
                  </div>
                  <div className={`text-center py-2 rounded-lg text-xs font-semibold ${selectedDraft.status === 'approved' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                    {selectedDraft.status === 'approved' ? '✓ تم نشر هذا المسار' : '✕ تم رفض هذا المسار'}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Route detail overlay */}
        {selectedRoute && adminTab === 'routes' && (
          <Card className="absolute bottom-4 left-4 z-10 w-[360px] max-w-[calc(100%-2rem)] max-h-[calc(100%-2rem)] overflow-y-auto shadow-2xl bg-card/95 backdrop-blur-sm" dir="rtl">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 shadow-xs" style={{ backgroundColor: getRouteColor(selectedRoute.color_index ?? 0) }} />
                    <CardTitle className="text-base">{selectedRoute.name_ar}</CardTitle>
                  </div>
                  {selectedRoute.name_en && <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{selectedRoute.name_en}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setSelectedRoute(null); setSelectedRouteGeoJson(null) }}>✕</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">المدينة</span><p className="font-medium">{selectedRoute.city?.name_ar ?? selectedRoute.city_id}</p></div>
                <div><span className="text-muted-foreground">الحالة</span><p className="font-medium">{ROUTE_STATUS_LABELS[selectedRoute.status]}</p></div>
                <div><span className="text-muted-foreground">التعرفة</span><p className="font-medium">{selectedRoute.price_new ? `${selectedRoute.price_new} ل.س` : 'غير محدد'}</p></div>
                <div><span className="text-muted-foreground">المواقف</span><p className="font-medium">{selectedRoute.stops_count} موقف</p></div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">الخط اللامع = المسار المحدد. الخطوط الباهتة = باقي خطوط المدينة.</p>

              <div className="space-y-1 pt-1 border-t border-border/50">
                <label className="text-[11px] font-semibold text-muted-foreground block">تغيير لون المسار سريعاً:</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ROUTE_PALETTE.map((colorHex, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleQuickUpdateColor(idx)}
                      className={`w-6 h-6 rounded-full border-2 transition-all ${selectedRoute.color_index === idx ? 'scale-110 border-foreground shadow-md ring-2 ring-primary/40' : 'border-transparent opacity-75 hover:opacity-100'}`}
                      style={{ backgroundColor: colorHex }}
                      title={`تغيير للون ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => { setEditRouteNameAr(selectedRoute.name_ar); setEditRouteNameEn(selectedRoute.name_en ?? ''); setEditRoutePrice(selectedRoute.price_new != null ? String(selectedRoute.price_new) : ''); setEditRouteColorIndex(selectedRoute.color_index ?? 0); setIsEditRouteModalOpen(true) }}>
                  <Pencil className="h-3.5 w-3.5" /> تعديل الاسم واللون
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => router.get(`/transit/studio?edit=${selectedRoute.id}`)}>
                  <Pencil className="h-3.5 w-3.5" /> تعديل في الاستوديو
                </Button>
                {selectedRoute.status === 'published' ? (
                  <Button variant="destructive" size="sm" className="text-xs" disabled={actionLoading} onClick={() => handleUpdateStatus(selectedRoute.id, 'disapproved')}>
                    <XCircle className="h-3.5 w-3.5" /> تعطيل
                  </Button>
                ) : (
                  <Button size="sm" className="text-xs" disabled={actionLoading} onClick={() => handleUpdateStatus(selectedRoute.id, 'published')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> تفعيل
                  </Button>
                )}
                {selectedRoute.status !== 'hidden' && (
                  <Button variant="secondary" size="sm" className="text-xs" disabled={actionLoading} onClick={() => handleUpdateStatus(selectedRoute.id, 'hidden')}>
                    <EyeOff className="h-3.5 w-3.5" /> إخفاء
                  </Button>
                )}
                <Button variant="outline" size="sm" className="text-xs" disabled={actionLoading} onClick={() => { setTargetCityId(selectedRoute.city_id); setIsMoveModalOpen(true) }}>
                  <MoveRight className="h-3.5 w-3.5" /> نقل لمدينة
                </Button>
                <Button variant="outline" size="sm" className="text-xs" disabled={actionLoading} onClick={async () => {
                  setActionLoading(true)
                  try {
                    const res = await fetch(`/api/v1/admin/routes/${selectedRoute.id}/stops`)
                    if (res.ok) {
                      const sd = await res.json(); setRouteStops(sd)
                      setSplitAtStopId(sd[1]?.id || '')
                      setSplitNameAAr(`${selectedRoute.name_ar} (القسم الأول)`)
                      setSplitNameBAr(`${selectedRoute.name_ar} (القسم الثاني)`)
                      setSplitNameAEn(selectedRoute.name_en ? `${selectedRoute.name_en} (Part 1)` : '')
                      setSplitNameBEn(selectedRoute.name_en ? `${selectedRoute.name_en} (Part 2)` : '')
                      setIsSplitModalOpen(true)
                    }
                  } catch { showToast('خطأ في الاتصال', false) } finally { setActionLoading(false) }
                }}>
                  <GitBranch className="h-3.5 w-3.5" /> تقسيم الخط
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!selectedDraft && adminTab === 'drafts' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 py-3 text-sm text-muted-foreground">اختر مسودة لمعاينتها على الخريطة</div>
          </div>
        )}
        {!selectedRoute && adminTab === 'routes' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 py-3 text-sm text-muted-foreground">اختر خطاً للمعاينة والتحكم</div>
          </div>
        )}
        {adminTab === 'logs' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-card/80 backdrop-blur-sm border border-border rounded-xl px-5 py-3 text-sm text-muted-foreground">تصفح سجل العمليات في القائمة الجانبية</div>
          </div>
        )}
      </div>

      {/* ── Reject Dialog ───────────────────────────────────────────────── */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>رفض المسار</DialogTitle>
            <DialogDescription>أضف سبب الرفض — سيظهر للمساهم.</DialogDescription>
          </DialogHeader>
          <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="سبب الرفض (اختياري)…" rows={4} />
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)}>إلغاء</Button>
            <Button variant="destructive" size="sm" disabled={actionLoading} onClick={handleRejectConfirm}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الرفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Combine Dialog ─────────────────────────────────────────────── */}
      <Dialog open={isCombineModalOpen} onOpenChange={setIsCombineModalOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>دمج خطوط النقل</DialogTitle>
            <DialogDescription>اختر خطين في نفس المدينة لدمجهما في خط جديد.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">المدينة</label>
              <Select value={combineCityId} onValueChange={v => { setCombineCityId(v); setCombineRouteAId(''); setCombineRouteBId('') }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر المدينة…" /></SelectTrigger>
                <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الخط الأول (البداية)</label>
              <Select value={combineRouteAId} onValueChange={setCombineRouteAId} disabled={!combineCityId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر الخط…" /></SelectTrigger>
                <SelectContent>{publishedRoutes.filter(r => r.city_id === combineCityId && r.status === 'published').map(r => <SelectItem key={r.id} value={r.id}>{r.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الخط الثاني (الامتداد)</label>
              <Select value={combineRouteBId} onValueChange={setCombineRouteBId} disabled={!combineCityId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر الخط…" /></SelectTrigger>
                <SelectContent>{publishedRoutes.filter(r => r.city_id === combineCityId && r.status === 'published' && r.id !== combineRouteAId).map(r => <SelectItem key={r.id} value={r.id}>{r.name_ar}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">الاسم بالعربية</label>
                <Input value={combineNameAr} onChange={e => setCombineNameAr(e.target.value)} placeholder="مثال: الدوار الجنوبي" className="h-9 text-xs" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">الاسم بالإنجليزية</label>
                <Input value={combineNameEn} onChange={e => setCombineNameEn(e.target.value)} placeholder="e.g. Southern Ring" className="h-9 text-xs" dir="ltr" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">التعرفة الجديدة (ل.س)</label>
              <Input type="number" value={combinePrice} onChange={e => setCombinePrice(e.target.value)} placeholder="اترك فارغاً للحفاظ على التعرفة الأصلية" className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsCombineModalOpen(false)}>إلغاء</Button>
            <Button size="sm" disabled={actionLoading || !combineRouteAId || !combineRouteBId || !combineNameAr.trim()} onClick={handleCombineRoutes}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} تأكيد الدمج
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Split Dialog ───────────────────────────────────────────────── */}
      <Dialog open={isSplitModalOpen} onOpenChange={setIsSplitModalOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تقسيم خط النقل</DialogTitle>
            <DialogDescription>سيتم تقسيم <strong>{selectedRoute?.name_ar}</strong> إلى خطين عند المحطة المحددة.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">نقطة التقسيم</label>
              <Select value={splitAtStopId} onValueChange={setSplitAtStopId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر محطة…" /></SelectTrigger>
                <SelectContent>
                  {routeStops.map((stop, i) => {
                    if (i === 0 || i === routeStops.length - 1) return null
                    return <SelectItem key={stop.id} value={stop.id}>{i + 1}. {stop.name_ar}</SelectItem>
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><label className="text-xs font-medium">اسم القسم الأول (عربي)</label><Input value={splitNameAAr} onChange={e => setSplitNameAAr(e.target.value)} className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">اسم القسم الأول (إنجليزي)</label><Input value={splitNameAEn} onChange={e => setSplitNameAEn(e.target.value)} className="h-9 text-xs" dir="ltr" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">اسم القسم الثاني (عربي)</label><Input value={splitNameBAr} onChange={e => setSplitNameBAr(e.target.value)} className="h-9 text-xs" /></div>
              <div className="space-y-1.5"><label className="text-xs font-medium">اسم القسم الثاني (إنجليزي)</label><Input value={splitNameBEn} onChange={e => setSplitNameBEn(e.target.value)} className="h-9 text-xs" dir="ltr" /></div>
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsSplitModalOpen(false)}>إلغاء</Button>
            <Button size="sm" disabled={actionLoading || !splitAtStopId || !splitNameAAr.trim() || !splitNameBAr.trim()} onClick={handleSplitRoute} className="bg-purple-600 hover:bg-purple-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />} تأكيد التقسيم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Move Dialog ────────────────────────────────────────────────── */}
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>نقل الخط لمدينة أخرى</DialogTitle>
            <DialogDescription>نقل <strong>{selectedRoute?.name_ar}</strong> والمواقف غير المشتركة مع خطوط أخرى.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-xs font-medium">المدينة المستهدفة</label>
            <Select value={targetCityId} onValueChange={setTargetCityId}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="اختر مدينة…" /></SelectTrigger>
              <SelectContent>{cities.map(c => <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsMoveModalOpen(false)}>إلغاء</Button>
            <Button size="sm" disabled={actionLoading || !targetCityId || targetCityId === selectedRoute?.city_id} onClick={handleMoveRoute} className="bg-blue-600 hover:bg-blue-700">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoveRight className="h-4 w-4" />} تأكيد النقل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Route Dialog ──────────────────────────────────────────────── */}
      <Dialog open={isEditRouteModalOpen} onOpenChange={setIsEditRouteModalOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الخط</DialogTitle>
            <DialogDescription>تعديل اسم، لون، و/أو تعرفة <strong>{selectedRoute?.name_ar}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الاسم بالعربية</label>
              <Input value={editRouteNameAr} onChange={e => setEditRouteNameAr(e.target.value)} className="h-9 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">الاسم بالإنجليزية</label>
              <Input value={editRouteNameEn} onChange={e => setEditRouteNameEn(e.target.value)} className="h-9 text-xs" dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium block">لون المسار على الخريطة</label>
              <div className="flex items-center gap-2 flex-wrap">
                {ROUTE_PALETTE.map((colorHex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setEditRouteColorIndex(idx)}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${editRouteColorIndex === idx ? 'scale-110 border-foreground shadow-md ring-2 ring-primary' : 'border-transparent opacity-75 hover:opacity-100'}`}
                    style={{ backgroundColor: colorHex }}
                    title={`لون ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">التعرفة (ل.س)</label>
              <Input type="number" value={editRoutePrice} onChange={e => setEditRoutePrice(e.target.value)} placeholder="اترك فارغاً للحفاظ على التعرفة الحالية" className="h-9 text-xs" />
            </div>
          </div>
          <DialogFooter className="flex-row-reverse gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditRouteModalOpen(false)}>إلغاء</Button>
            <Button size="sm" disabled={actionLoading || !editRouteNameAr.trim()} onClick={handleUpdateRoute}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-in fade-in slide-in-from-bottom-4 ${toast.ok ? 'bg-green-600 text-white' : 'bg-destructive text-destructive-foreground'}`}>
          {toast.msg}
        </div>
      )}
    </div>
    </>
  )
}

export default function TransitAdminPage() {
  return (
    <TransitLayout>
      <Head>
        <title>لوحة إدارة النقل | Syrian Zone</title>
      </Head>
      <TransitAdminPageContent />
    </TransitLayout>
  )
}
