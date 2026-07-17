'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminDrafts, useMapData } from '../_hooks/useMapData'
import TransitLayout from '../layout'
import { router, Head } from '@inertiajs/react'
import { useTransitTheme } from '../_components/TransitThemeContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type DraftStatus = 'pending' | 'approved' | 'rejected'

interface Draft {
  id: number
  user_id: number
  user: { name: string } | null
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

type StatusFilter = 'all' | DraftStatus

const STATUS_LABELS: Record<DraftStatus, string> = {
  pending:  'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
}

const API = () => '/api'

function stopCount(draft: Draft) {
  let geojson = draft.geojson
  if (typeof geojson === 'string') {
    try {
      geojson = JSON.parse(geojson)
    } catch (e) {
      console.error(e)
    }
  }
  return geojson?.features?.filter((f: any) => f.geometry?.type === 'Point').length ?? 0
}

function getCsrfToken(): string {
  const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

// ─── Component ────────────────────────────────────────────────────────────────
function TransitAdminPageContent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [mapReady,       setMapReady]       = useState(false)
  const { theme } = useTransitTheme()
  const [selectedDraft,  setSelectedDraft]  = useState<Draft | null>(null)
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all')
  const [cityFilter,     setCityFilter]     = useState('all')
  const [rejectOpen,     setRejectOpen]     = useState(false)
  const [rejectReason,   setRejectReason]   = useState('')
  const [actionLoading,  setActionLoading]  = useState(false)
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null)
  const [mobileView,     setMobileView]     = useState<'list' | 'map'>('list')

  // ─── New Admin States ────────────────────────────────────────────────────────
  const [adminTab,       setAdminTab]       = useState<AdminTab>('drafts')
  const [publishedRoutes, setPublishedRoutes] = useState<PublishedRoute[]>([])
  const [loadingRoutes,  setLoadingRoutes]  = useState(false)
  const [selectedRoute,  setSelectedRoute]  = useState<PublishedRoute | null>(null)
  const [selectedRouteGeoJson, setSelectedRouteGeoJson] = useState<any>(null)
  
  // Route Filters
  const [routeSearchQuery, setRouteSearchQuery] = useState('')
  const [routeCityFilter,   setRouteCityFilter]   = useState('all')
  const [routeStatusFilter, setRouteStatusFilter] = useState<'all' | 'published' | 'disapproved' | 'hidden'>('all')

  // Activity Logs
  const [logs,           setLogs]           = useState<ActivityLog[]>([])
  const [loadingLogs,    setLoadingLogs]    = useState(false)

  // Cities List
  const [cities,         setCities]         = useState<any[]>([])

  // Modal states
  const [isCombineModalOpen, setIsCombineModalOpen] = useState(false)
  const [combineCityId,      setCombineCityId]      = useState('')
  const [combineRouteAId,    setCombineRouteAId]    = useState('')
  const [combineRouteBId,    setCombineRouteBId]    = useState('')
  const [combineNameAr,      setCombineNameAr]      = useState('')
  const [combineNameEn,      setCombineNameEn]      = useState('')
  const [combinePrice,       setCombinePrice]       = useState('')

  const [isSplitModalOpen,   setIsSplitModalOpen]   = useState(false)
  const [splitAtStopId,      setSplitAtStopId]      = useState('')
  const [splitNameAAr,       setSplitNameAAr]       = useState('')
  const [splitNameAEn,       setSplitNameAEn]       = useState('')
  const [splitNameBAr,       setSplitNameBAr]       = useState('')
  const [splitNameBEn,       setSplitNameBEn]       = useState('')
  const [routeStops,         setRouteStops]         = useState<any[]>([])

  const [isMoveModalOpen,    setIsMoveModalOpen]    = useState(false)
  const [targetCityId,       setTargetCityId]       = useState('')

  const { data: drafts = [], isLoading, error: draftsError } = useAdminDrafts()

  const activeCityId = adminTab === 'drafts' ? selectedDraft?.city_id : selectedRoute?.city_id
  const { data: refData } = useMapData(activeCityId)
  const queryClient = useQueryClient()

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ─── Load Cities ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/v1/cities')
      .then(res => res.json())
      .then(data => setCities(data))
      .catch(err => console.error('Failed to load cities', err))
  }, [])

  // ─── Fetch Published Routes ──────────────────────────────────────────────────
  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true)
    try {
      const res = await fetch('/api/v1/admin/routes')
      if (res.ok) {
        const data = await res.json()
        setPublishedRoutes(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingRoutes(false)
    }
  }, [])

  // ─── Fetch Activity Logs ─────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true)
    try {
      const res = await fetch('/api/v1/admin/routes/logs')
      if (res.ok) {
        const data = await res.json()
        setLogs(data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingLogs(false)
    }
  }, [])

  // ─── Map init ────────────────────────────────────────────────────────────────
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

      // Reference layers (existing published data — behind draft)
      map.addSource('ref-routes', { type: 'geojson', data: empty })
      map.addSource('ref-stops',  { type: 'geojson', data: empty })
      map.addLayer({ id: 'ref-layer-routes', type: 'line',   source: 'ref-routes', paint: { 'line-color': '#c8963a', 'line-width': 2, 'line-opacity': 0.22 } })
      map.addLayer({ id: 'ref-layer-stops',  type: 'circle', source: 'ref-stops',  paint: { 'circle-radius': 4, 'circle-color': '#d4956a', 'circle-opacity': 0.28 } })

      // Draft layers (in front)
      map.addSource('draft-source', { type: 'geojson', data: empty })
      map.addLayer({
        id: 'draft-line', type: 'line', source: 'draft-source',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#f59e0b', 'line-width': 4 },
        filter: ['==', '$type', 'LineString'],
      })
      map.addLayer({
        id: 'draft-points', type: 'circle', source: 'draft-source',
        paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
        filter: ['==', '$type', 'Point'],
      })

      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [theme])

  // ─── Update draft layer when selection changes ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('draft-source') as maplibregl.GeoJSONSource | undefined
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    
    let geojsonData = empty
    if (adminTab === 'drafts') {
      geojsonData = selectedDraft?.geojson ?? empty
      if (typeof geojsonData === 'string') {
        try {
          geojsonData = JSON.parse(geojsonData)
        } catch (e) {
          console.error('Failed to parse geojson', e)
          geojsonData = empty
        }
      }
    } else if (adminTab === 'routes') {
      geojsonData = selectedRouteGeoJson ?? empty
    }

    src?.setData(geojsonData)

    if (geojsonData && geojsonData.features) {
      const line = geojsonData.features.find((f: any) => f.geometry?.type === 'LineString' || f.geometry?.type === 'MultiLineString')
      if (line && line.geometry?.coordinates) {
        let coords: [number, number][] = line.geometry.coordinates
        if (line.geometry.type === 'MultiLineString') {
          coords = coords.flat()
        }
        if (coords.length > 0) {
          const bounds = coords.reduce(
            (b, c) => b.extend(c as maplibregl.LngLatLike),
            new maplibregl.LngLatBounds(coords[0], coords[0])
          )
          mapRef.current.fitBounds(bounds, { padding: 80 })
        }
      }
    }
  }, [mapReady, selectedDraft, selectedRouteGeoJson, adminTab])

  // ─── Update reference layer when refData or selection changes ───────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    ;(mapRef.current.getSource('ref-routes') as maplibregl.GeoJSONSource | undefined)?.setData((refData?.routes ?? empty) as any)
    ;(mapRef.current.getSource('ref-stops')  as maplibregl.GeoJSONSource | undefined)?.setData((refData?.stops  ?? empty) as any)
  }, [mapReady, refData])

  // ─── Resize map when switching to map view on mobile ───────────────────────
  useEffect(() => {
    if (mobileView === 'map') {
      setTimeout(() => mapRef.current?.resize(), 60)
    }
  }, [mobileView])

  // ─── Approve ────────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (id: number) => {
    setActionLoading(true)
    try {
      const res = await fetch(`${API()}/v1/admin/route-drafts/${id}/approve`, {
        method: 'POST',
        headers: {
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'include',
      })
      if (res.ok) {
        showToast('تمت الموافقة على المسار ونشره')
        setSelectedDraft(null)
        queryClient.invalidateQueries({ queryKey: ['admin-drafts'] })
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (err.message ?? `HTTP ${res.status}`), false)
      }
    } catch { showToast('تعذّر الاتصال بالخادم', false) }
    finally { setActionLoading(false) }
  }, [queryClient, showToast])

  // ─── Reject ─────────────────────────────────────────────────────────────────
  const handleRejectConfirm = useCallback(async () => {
    if (!selectedDraft) return
    setActionLoading(true)
    try {
      const res = await fetch(`${API()}/v1/admin/route-drafts/${selectedDraft.id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ reason: rejectReason.trim() || null }),
      })
      if (res.ok) {
        showToast('تم رفض المسار')
        setSelectedDraft(null)
        setRejectOpen(false)
        setRejectReason('')
        queryClient.invalidateQueries({ queryKey: ['admin-drafts'] })
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (err.message ?? `HTTP ${res.status}`), false)
      }
    } catch { showToast('تعذّر الاتصال بالخادم', false) }
    finally { setActionLoading(false) }
  }, [selectedDraft, rejectReason, queryClient, showToast])

  // ─── Select Published Route ──────────────────────────────────────────────────
  const handleSelectRoute = useCallback(async (route: PublishedRoute) => {
    setSelectedRoute(route)
    setMobileView('map')
    try {
      const res = await fetch(`/api/v1/admin/routes/${route.id}/geojson`)
      if (res.ok) {
        const geojsonData = await res.json()
        setSelectedRouteGeoJson(geojsonData)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  // ─── Update Status ───────────────────────────────────────────────────────────
  const handleUpdateStatus = useCallback(async (routeId: string, newStatus: string) => {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/routes/${routeId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        showToast('تم تحديث حالة الخط بنجاح')
        fetchRoutes()
        if (selectedRoute?.id === routeId) {
          setSelectedRoute(prev => prev ? { ...prev, status: newStatus as any } : null)
        }
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (err.message ?? `HTTP ${res.status}`), false)
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setActionLoading(false)
    }
  }, [fetchRoutes, selectedRoute, showToast])

  // ─── Move Route ──────────────────────────────────────────────────────────────
  const handleMoveRoute = useCallback(async () => {
    if (!selectedRoute) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/routes/${selectedRoute.id}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({ city_id: targetCityId }),
      })
      if (res.ok) {
        showToast('تم نقل الخط بنجاح')
        setIsMoveModalOpen(false)
        setSelectedRoute(null)
        setSelectedRouteGeoJson(null)
        fetchRoutes()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (err.message ?? `HTTP ${res.status}`), false)
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setActionLoading(false)
    }
  }, [selectedRoute, targetCityId, fetchRoutes, showToast])

  // ─── Combine Routes ──────────────────────────────────────────────────────────
  const handleCombineRoutes = useCallback(async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/v1/admin/routes/combine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({
          route_a_id: combineRouteAId,
          route_b_id: combineRouteBId,
          name_ar: combineNameAr.trim(),
          name_en: combineNameEn.trim() || null,
          price: combinePrice ? parseInt(combinePrice) : null,
        }),
      })
      if (res.ok) {
        showToast('تم دمج الخطين بنجاح وإنشاء الخط الجديد')
        setIsCombineModalOpen(false)
        setCombineRouteAId('')
        setCombineRouteBId('')
        setCombineNameAr('')
        setCombineNameEn('')
        setCombinePrice('')
        fetchRoutes()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (err.message ?? `HTTP ${res.status}`), false)
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setActionLoading(false)
    }
  }, [combineRouteAId, combineRouteBId, combineNameAr, combineNameEn, combinePrice, fetchRoutes, showToast])

  // ─── Split Route ─────────────────────────────────────────────────────────────
  const handleSplitRoute = useCallback(async () => {
    if (!selectedRoute) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/v1/admin/routes/split', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-XSRF-TOKEN': getCsrfToken(),
        },
        credentials: 'include',
        body: JSON.stringify({
          route_id: selectedRoute.id,
          split_stop_id: splitAtStopId,
          name_a_ar: splitNameAAr.trim(),
          name_a_en: splitNameAEn.trim() || null,
          name_b_ar: splitNameBAr.trim(),
          name_b_en: splitNameBEn.trim() || null,
        }),
      })
      if (res.ok) {
        showToast('تم تقسيم الخط بنجاح إلى خطين جديدين')
        setIsSplitModalOpen(false)
        setSelectedRoute(null)
        setSelectedRouteGeoJson(null)
        setSplitAtStopId('')
        setSplitNameAAr('')
        setSplitNameAEn('')
        setSplitNameBAr('')
        setSplitNameBEn('')
        fetchRoutes()
      } else {
        const err = await res.json().catch(() => ({}))
        showToast('خطأ: ' + (err.message ?? `HTTP ${res.status}`), false)
      }
    } catch {
      showToast('تعذّر الاتصال بالخادم', false)
    } finally {
      setActionLoading(false)
    }
  }, [selectedRoute, splitAtStopId, splitNameAAr, splitNameAEn, splitNameBAr, splitNameBEn, fetchRoutes, showToast])

  // ─── Derived data ────────────────────────────────────────────────────────────
  const stats = {
    pending:  drafts.filter((d: Draft) => d.status === 'pending').length,
    approved: drafts.filter((d: Draft) => d.status === 'approved').length,
    rejected: drafts.filter((d: Draft) => d.status === 'rejected').length,
  }

  const uniqueCities = Array.from(new Set(drafts.map((d: Draft) => d.city_id))) as string[]

  const filteredDrafts: Draft[] = drafts
    .filter((d: Draft) => statusFilter === 'all' || d.status === statusFilter)
    .filter((d: Draft) => cityFilter === 'all' || d.city_id === cityFilter)
    .sort((a: Draft, b: Draft) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const filteredRoutes = publishedRoutes
    .filter(r => routeStatusFilter === 'all' || r.status === routeStatusFilter)
    .filter(r => routeCityFilter === 'all' || r.city_id === routeCityFilter)
    .filter(r => {
      const q = routeSearchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        r.name_ar.toLowerCase().includes(q) ||
        (r.name_en?.toLowerCase() || '').includes(q)
      )
    })

  const handleLogout = useCallback(() => {
    router.post('/logout')
  }, [])

  return (
    <div className={`adm-shell${mobileView === 'map' ? ' adm-shell--map-view' : ''}`} dir="rtl">

      {/* Sidebar */}
      <aside className="adm-sidebar">
        <header className="adm-sidebar-header">
          <div>
            <h1 className="adm-title">لوحة الإدارة</h1>
            <p className="adm-subtitle">التحكم في مسارات النقل</p>
          </div>
          <button type="button" className="adm-logout-btn" onClick={handleLogout} title="تسجيل الخروج">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </header>

        {/* Tab switcher */}
        <div className="adm-nav-tabs">
          <button
            type="button"
            className={`adm-nav-tab ${adminTab === 'drafts' ? 'adm-nav-tab--active' : ''}`}
            onClick={() => {
              setAdminTab('drafts')
              setSelectedRoute(null)
              setSelectedRouteGeoJson(null)
            }}
          >
            طلبات المسودات
          </button>
          <button
            type="button"
            className={`adm-nav-tab ${adminTab === 'routes' ? 'adm-nav-tab--active' : ''}`}
            onClick={() => {
              setAdminTab('routes')
              setSelectedDraft(null)
              fetchRoutes()
            }}
          >
            إدارة الخطوط
          </button>
          <button
            type="button"
            className={`adm-nav-tab ${adminTab === 'logs' ? 'adm-nav-tab--active' : ''}`}
            onClick={() => {
              setAdminTab('logs')
              setSelectedDraft(null)
              setSelectedRoute(null)
              setSelectedRouteGeoJson(null)
              fetchLogs()
            }}
          >
            سجل العمليات
          </button>
        </div>

        {/* DRAFTS TAB */}
        {adminTab === 'drafts' && (
          <>
            {/* Stats */}
            <div className="adm-stats">
              <div className="adm-stat adm-stat--pending">
                <span className="adm-stat-num">{stats.pending}</span>
                <span className="adm-stat-label">بانتظار المراجعة</span>
              </div>
              <div className="adm-stat adm-stat--approved">
                <span className="adm-stat-num">{stats.approved}</span>
                <span className="adm-stat-label">مقبول</span>
              </div>
              <div className="adm-stat adm-stat--rejected">
                <span className="adm-stat-num">{stats.rejected}</span>
                <span className="adm-stat-label">مرفوض</span>
              </div>
            </div>

            {/* Filters */}
            <div className="adm-filters">
              <div className="adm-status-tabs">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`adm-tab ${statusFilter === s ? 'adm-tab--active' : ''}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? 'الكل' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {uniqueCities.length > 1 && (
                <div className="adm-select-wrap">
                  <select
                    className="adm-select"
                    value={cityFilter}
                    onChange={e => setCityFilter(e.target.value)}
                  >
                    <option value="all">جميع المدن</option>
                    {uniqueCities.map(id => (
                      <option key={id} value={id}>{id}</option>
                    ))}
                  </select>
                  <svg className="adm-select-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              )}
            </div>

            {/* Draft list */}
            <div className="adm-list">
              {isLoading ? (
                <div className="adm-empty">جاري التحميل…</div>
              ) : draftsError ? (
                <div className="adm-empty adm-empty--error">
                  تعذّر تحميل البيانات<br/>
                  <span className="adm-empty-detail">{String(draftsError)}</span>
                </div>
              ) : filteredDrafts.length === 0 ? (
                <div className="adm-empty">لا توجد نتائج</div>
              ) : filteredDrafts.map((draft: Draft) => (
                <button
                  key={draft.id}
                  type="button"
                  className={`adm-draft-item ${selectedDraft?.id === draft.id ? 'adm-draft-item--active' : ''}`}
                  onClick={() => { setSelectedDraft(draft); setMobileView('map') }}
                >
                  <div className="adm-draft-top">
                    <span className="adm-draft-name">{draft.name_ar}</span>
                    <span className={`adm-badge adm-badge--${draft.status}`}>
                      {STATUS_LABELS[draft.status]}
                    </span>
                  </div>
                  <div className="adm-draft-meta">
                    <span>{draft.city?.name_ar ?? draft.city_id}</span>
                    <span className="adm-meta-sep">·</span>
                    <span>{draft.user?.name ?? 'مجهول'}</span>
                    <span className="adm-meta-sep">·</span>
                    <span>{stopCount(draft)} محطة</span>
                    <span className="adm-meta-sep">·</span>
                    <span>{new Date(draft.created_at).toLocaleDateString('ar-SY')}</span>
                  </div>
                  {draft.status === 'rejected' && draft.rejection_reason && (
                    <p className="adm-rejection-reason">{draft.rejection_reason}</p>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        {/* ROUTES TAB */}
        {adminTab === 'routes' && (
          <>
            {/* Quick Actions */}
            <div className="p-3 border-b border-[var(--border)] flex gap-2">
              <button
                type="button"
                className="w-full py-2 px-3 bg-[var(--gold)] text-[var(--bg)] hover:opacity-90 font-bold text-xs rounded-lg transition-opacity flex items-center justify-center gap-1"
                onClick={() => {
                  setCombineCityId('')
                  setCombineRouteAId('')
                  setCombineRouteBId('')
                  setCombineNameAr('')
                  setCombineNameEn('')
                  setCombinePrice('')
                  setIsCombineModalOpen(true)
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
                دمج خطين
              </button>
            </div>

            {/* Filters */}
            <div className="adm-filters">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="adm-login-input text-xs py-1.5 px-3 rounded-lg"
                  placeholder="بحث باسم الخط..."
                  value={routeSearchQuery}
                  onChange={e => setRouteSearchQuery(e.target.value)}
                />
              </div>
              <div className="adm-status-tabs">
                {(['all', 'published', 'disapproved', 'hidden'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    className={`adm-tab ${routeStatusFilter === s ? 'adm-tab--active' : ''}`}
                    onClick={() => setRouteStatusFilter(s)}
                  >
                    {s === 'all' ? 'الكل' : s === 'published' ? 'نشط' : s === 'disapproved' ? 'معطل' : 'مخفي'}
                  </button>
                ))}
              </div>
              <div className="adm-select-wrap">
                <select
                  className="adm-select"
                  value={routeCityFilter}
                  onChange={e => setRouteCityFilter(e.target.value)}
                >
                  <option value="all">جميع المدن</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
                <svg className="adm-select-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </div>
            </div>

            {/* Routes List */}
            <div className="adm-list">
              {loadingRoutes ? (
                <div className="adm-empty">جاري التحميل…</div>
              ) : filteredRoutes.length === 0 ? (
                <div className="adm-empty">لا توجد خطوط منشورة مطابقة</div>
              ) : filteredRoutes.map((route: PublishedRoute) => (
                <button
                  key={route.id}
                  type="button"
                  className={`adm-draft-item ${selectedRoute?.id === route.id ? 'adm-draft-item--active' : ''}`}
                  onClick={() => handleSelectRoute(route)}
                >
                  <div className="adm-draft-top">
                    <span className="adm-draft-name">{route.name_ar}</span>
                    <span className={`adm-badge ${route.status === 'published' ? 'adm-badge--approved' : route.status === 'disapproved' ? 'adm-badge--rejected' : 'adm-badge--pending'}`}>
                      {route.status === 'published' ? 'منشور' : route.status === 'disapproved' ? 'معطل' : 'مخفي'}
                    </span>
                  </div>
                  <div className="adm-draft-meta">
                    <span>{route.city?.name_ar ?? route.city_id}</span>
                    <span className="adm-meta-sep">·</span>
                    <span>{route.stops_count} موقف</span>
                    {route.price_new && (
                      <>
                        <span className="adm-meta-sep">·</span>
                        <span>{route.price_new} ل.س</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* LOGS TAB */}
        {adminTab === 'logs' && (
          <div className="adm-log-list">
            {loadingLogs ? (
              <div className="adm-empty">جاري التحميل…</div>
            ) : logs.length === 0 ? (
              <div className="adm-empty">لا يوجد سجل عمليات</div>
            ) : logs.map((log: ActivityLog) => (
              <div key={log.id} className="adm-log-item">
                <div className="adm-log-header">
                  <span className={`adm-log-action adm-log-action--${log.action}`}>
                    {log.action === 'approved' ? 'نشر' : log.action === 'disapproved' ? 'تعطيل' : log.action === 'restored' ? 'تفعيل' : log.action === 'hidden' ? 'إخفاء' : log.action === 'combined' ? 'دمج' : log.action === 'split' ? 'تقسيم' : log.action === 'moved' ? 'نقل' : log.action}
                  </span>
                  <span className="text-xs text-[var(--muted)]">{new Date(log.created_at).toLocaleString('ar-SY')}</span>
                </div>
                <p className="adm-log-desc">{log.description}</p>
                <div className="adm-log-meta">
                  <span>المسؤول: {log.user?.name ?? 'مجهول'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Map panel */}
      <div className="adm-map-panel">
        <button
          type="button"
          className="adm-mobile-back"
          onClick={() => setMobileView('list')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          القائمة
        </button>
        <div ref={mapContainer} className="adm-map" />

        {/* Draft detail overlay */}
        {selectedDraft && adminTab === 'drafts' && (
          <div className="adm-detail">
            <div className="adm-detail-header">
              <div>
                <h2 className="adm-detail-title">{selectedDraft.name_ar}</h2>
                {selectedDraft.name_en && <p className="adm-detail-subtitle" dir="ltr">{selectedDraft.name_en}</p>}
              </div>
              <button type="button" className="adm-detail-close" onClick={() => setSelectedDraft(null)}>✕</button>
            </div>

            <div className="adm-detail-rows">
              <div className="adm-detail-row">
                <span className="adm-detail-label">المدينة</span>
                <span>{selectedDraft.city?.name_ar ?? selectedDraft.city_id}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">المساهم</span>
                <span>{selectedDraft.user?.name ?? 'مجهول'}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">التعرفة</span>
                <span>{selectedDraft.price ? `${selectedDraft.price} ل.س` : 'غير محدد'}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">المحطات</span>
                <span>{stopCount(selectedDraft)} محطة</span>
              </div>
              {selectedDraft.notes && (
                <div className="adm-detail-row">
                  <span className="adm-detail-label">ملاحظات</span>
                  <span>{selectedDraft.notes}</span>
                </div>
              )}
            </div>

            <div className="adm-detail-hint">
              الخطوط الباهتة = البيانات المنشورة الحالية. الخط البرتقالي = المسار المقترح.
            </div>

            {selectedDraft.status === 'pending' && (
              <div className="adm-detail-actions">
                <button
                  type="button"
                  className="adm-btn adm-btn--approve"
                  disabled={actionLoading}
                  onClick={() => handleApprove(selectedDraft.id)}
                >
                  {actionLoading ? '…' : 'موافقة ونشر'}
                </button>
                <button
                  type="button"
                  className="adm-btn adm-btn--reject"
                  disabled={actionLoading}
                  onClick={() => { setRejectReason(''); setRejectOpen(true) }}
                >
                  رفض
                </button>
              </div>
            )}

            {selectedDraft.status !== 'pending' && (
              <div className={`adm-status-resolved adm-status-resolved--${selectedDraft.status}`}>
                {selectedDraft.status === 'approved' ? '✓ تم نشر هذا المسار' : '✕ تم رفض هذا المسار'}
                {selectedDraft.rejection_reason && (
                  <p className="adm-resolved-reason">{selectedDraft.rejection_reason}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Route detail overlay */}
        {selectedRoute && adminTab === 'routes' && (
          <div className="adm-detail">
            <div className="adm-detail-header">
              <div>
                <h2 className="adm-detail-title">{selectedRoute.name_ar}</h2>
                {selectedRoute.name_en && <p className="adm-detail-subtitle" dir="ltr">{selectedRoute.name_en}</p>}
              </div>
              <button type="button" className="adm-detail-close" onClick={() => { setSelectedRoute(null); setSelectedRouteGeoJson(null); }}>✕</button>
            </div>

            <div className="adm-detail-rows">
              <div className="adm-detail-row">
                <span className="adm-detail-label">المدينة</span>
                <span>{selectedRoute.city?.name_ar ?? selectedRoute.city_id}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">الحالة الحالية</span>
                <span className={`adm-badge ${selectedRoute.status === 'published' ? 'adm-badge--approved' : selectedRoute.status === 'disapproved' ? 'adm-badge--rejected' : 'adm-badge--pending'}`}>
                  {selectedRoute.status === 'published' ? 'منشور' : selectedRoute.status === 'disapproved' ? 'معطل' : 'مخفي'}
                </span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">التعرفة</span>
                <span>{selectedRoute.price_new ? `${selectedRoute.price_new} ل.س` : 'غير محدد'}</span>
              </div>
              <div className="adm-detail-row">
                <span className="adm-detail-label">المواقف</span>
                <span>{selectedRoute.stops_count} موقف</span>
              </div>
            </div>

            <div className="adm-detail-hint">
              الخط البرتقالي = المسار المحدد. الخطوط الباهتة = باقي خطوط المدينة.
            </div>

            <div className="adm-detail-actions flex-wrap gap-2 mt-4">
              {selectedRoute.status === 'published' ? (
                <button
                  type="button"
                  className="adm-btn adm-btn--reject flex-1"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(selectedRoute.id, 'disapproved')}
                >
                  تعطيل (إلغاء نشر)
                </button>
              ) : (
                <button
                  type="button"
                  className="adm-btn adm-btn--approve flex-1"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(selectedRoute.id, 'published')}
                >
                  تفعيل ونشر الخط
                </button>
              )}

              {selectedRoute.status !== 'hidden' && (
                <button
                  type="button"
                  className="adm-btn bg-zinc-600 hover:bg-zinc-700 text-white flex-1 text-xs py-2 px-3 rounded-lg font-bold"
                  disabled={actionLoading}
                  onClick={() => handleUpdateStatus(selectedRoute.id, 'hidden')}
                >
                  إخفاء الخط
                </button>
              )}

              <button
                type="button"
                className="adm-btn bg-blue-600 hover:bg-blue-700 text-white flex-1 text-xs py-2 px-3 rounded-lg font-bold"
                disabled={actionLoading}
                onClick={() => {
                  setTargetCityId(selectedRoute.city_id)
                  setIsMoveModalOpen(true)
                }}
              >
                نقل لمدينة
              </button>

              <button
                type="button"
                className="adm-btn bg-purple-600 hover:bg-purple-700 text-white flex-1 text-xs py-2 px-3 rounded-lg font-bold"
                disabled={actionLoading}
                onClick={async () => {
                  setActionLoading(true)
                  try {
                    const res = await fetch(`/api/v1/admin/routes/${selectedRoute.id}/stops`)
                    if (res.ok) {
                      const stopsData = await res.json()
                      setRouteStops(stopsData)
                      setSplitAtStopId(stopsData[1]?.id || '')
                      setSplitNameAAr(`${selectedRoute.name_ar} (القسم الأول)`)
                      setSplitNameBAr(`${selectedRoute.name_ar} (القسم الثاني)`)
                      setSplitNameAEn(selectedRoute.name_en ? `${selectedRoute.name_en} (Part 1)` : '')
                      setSplitNameBEn(selectedRoute.name_en ? `${selectedRoute.name_en} (Part 2)` : '')
                      setIsSplitModalOpen(true)
                    } else {
                      showToast('فشل في تحميل مواقف الخط', false)
                    }
                  } catch {
                    showToast('خطأ في الاتصال', false)
                  } finally {
                    setActionLoading(false)
                  }
                }}
              >
                تقسيم الخط
              </button>
            </div>
          </div>
        )}

        {/* Empty state hints */}
        {!selectedDraft && adminTab === 'drafts' && (
          <div className="adm-map-hint">اختر مسودة من القائمة لمعاينتها على الخريطة</div>
        )}
        {!selectedRoute && adminTab === 'routes' && (
          <div className="adm-map-hint">اختر خطاً من القائمة لمعاينته والتحكم به</div>
        )}
        {adminTab === 'logs' && (
          <div className="adm-map-hint">تصفح سجل العمليات الإدارية في القائمة الجانبية</div>
        )}
      </div>

      {/* Reject dialog */}
      {rejectOpen && (
        <div className="adm-overlay" onClick={e => { if (e.target === e.currentTarget) setRejectOpen(false) }}>
          <div className="adm-dialog" dir="rtl">
            <div className="adm-dialog-header">
              <h3 className="adm-dialog-title">رفض المسار</h3>
              <button type="button" className="adm-detail-close" onClick={() => setRejectOpen(false)}>✕</button>
            </div>
            <p className="adm-dialog-desc">أضف سبب الرفض — سيظهر للمساهم ليتمكن من التحسين.</p>
            <textarea
              className="adm-textarea"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="سبب الرفض (اختياري)…"
              rows={4}
              autoFocus
            />
            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setRejectOpen(false)}>إلغاء</button>
              <button type="button" className="adm-btn adm-btn--reject" disabled={actionLoading} onClick={handleRejectConfirm}>
                {actionLoading ? '…' : 'تأكيد الرفض'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Combine Modal */}
      {isCombineModalOpen && (
        <div className="adm-overlay" onClick={e => { if (e.target === e.currentTarget) setIsCombineModalOpen(false) }}>
          <div className="adm-dialog" dir="rtl">
            <div className="adm-dialog-header">
              <h3 className="adm-dialog-title">دمج خطوط النقل</h3>
              <button type="button" className="adm-detail-close" onClick={() => setIsCombineModalOpen(false)}>✕</button>
            </div>
            <p className="adm-dialog-desc">اختر خطين في نفس المدينة لدمجهما في خط جديد واحد متتابع.</p>
            <div className="adm-dialog-fields">
              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">المدينة</label>
                <select
                  className="adm-dialog-select"
                  value={combineCityId}
                  onChange={e => {
                    setCombineCityId(e.target.value)
                    setCombineRouteAId('')
                    setCombineRouteBId('')
                  }}
                >
                  <option value="">اختر المدينة...</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">الخط الأول (البداية)</label>
                <select
                  className="adm-dialog-select"
                  value={combineRouteAId}
                  onChange={e => setCombineRouteAId(e.target.value)}
                  disabled={!combineCityId}
                >
                  <option value="">اختر الخط الأول...</option>
                  {publishedRoutes
                    .filter(r => r.city_id === combineCityId && r.status === 'published')
                    .map(r => (
                      <option key={r.id} value={r.id}>{r.name_ar}</option>
                    ))}
                </select>
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">الخط الثاني (الامتداد)</label>
                <select
                  className="adm-dialog-select"
                  value={combineRouteBId}
                  onChange={e => setCombineRouteBId(e.target.value)}
                  disabled={!combineCityId}
                >
                  <option value="">اختر الخط الثاني...</option>
                  {publishedRoutes
                    .filter(r => r.city_id === combineCityId && r.status === 'published' && r.id !== combineRouteAId)
                    .map(r => (
                      <option key={r.id} value={r.id}>{r.name_ar}</option>
                    ))}
                </select>
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">اسم الخط الجديد (بالعربية)</label>
                <input
                  type="text"
                  className="adm-dialog-input"
                  value={combineNameAr}
                  onChange={e => setCombineNameAr(e.target.value)}
                  placeholder="مثال: الدوار الجنوبي - المزة"
                />
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">اسم الخط الجديد (بالإنجليزية)</label>
                <input
                  type="text"
                  className="adm-dialog-input"
                  value={combineNameEn}
                  onChange={e => setCombineNameEn(e.target.value)}
                  placeholder="e.g. Southern Ring - Mezzeh"
                  dir="ltr"
                />
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">التعرفة الجديدة (ل.س)</label>
                <input
                  type="number"
                  className="adm-dialog-input"
                  value={combinePrice}
                  onChange={e => setCombinePrice(e.target.value)}
                  placeholder="اترك فارغاً لاستخدام تعرفة الخطوط الأصلية"
                />
              </div>
            </div>

            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setIsCombineModalOpen(false)}>إلغاء</button>
              <button
                type="button"
                className="adm-btn adm-btn--approve"
                disabled={actionLoading || !combineRouteAId || !combineRouteBId || !combineNameAr.trim()}
                onClick={handleCombineRoutes}
              >
                {actionLoading ? '…' : 'تأكيد الدمج ونشر الخط'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Split Modal */}
      {isSplitModalOpen && selectedRoute && (
        <div className="adm-overlay" onClick={e => { if (e.target === e.currentTarget) setIsSplitModalOpen(false) }}>
          <div className="adm-dialog" dir="rtl">
            <div className="adm-dialog-header">
              <h3 className="adm-dialog-title">تقسيم خط النقل</h3>
              <button type="button" className="adm-detail-close" onClick={() => setIsSplitModalOpen(false)}>✕</button>
            </div>
            <p className="adm-dialog-desc">سيتم تقسيم خط <strong>{selectedRoute.name_ar}</strong> إلى خطين منفصلين عند المحطة المحددة.</p>
            <div className="adm-dialog-fields">
              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">نقطة التقسيم (المحطة المشتركة الأخيرة للقسم الأول)</label>
                <select
                  className="adm-dialog-select"
                  value={splitAtStopId}
                  onChange={e => setSplitAtStopId(e.target.value)}
                >
                  <option value="">اختر محطة التقسيم...</option>
                  {routeStops.map((stop, sIdx) => {
                    if (sIdx === 0 || sIdx === routeStops.length - 1) return null
                    return (
                      <option key={stop.id} value={stop.id}>
                        {sIdx + 1}. {stop.name_ar}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">اسم القسم الأول (بالعربية)</label>
                <input type="text" className="adm-dialog-input" value={splitNameAAr} onChange={e => setSplitNameAAr(e.target.value)} />
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">اسم القسم الأول (بالإنجليزية)</label>
                <input type="text" className="adm-dialog-input" value={splitNameAEn} onChange={e => setSplitNameAEn(e.target.value)} dir="ltr" />
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">اسم القسم الثاني (بالعربية)</label>
                <input type="text" className="adm-dialog-input" value={splitNameBAr} onChange={e => setSplitNameBAr(e.target.value)} />
              </div>

              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">اسم القسم الثاني (بالإنجليزية)</label>
                <input type="text" className="adm-dialog-input" value={splitNameBEn} onChange={e => setSplitNameBEn(e.target.value)} dir="ltr" />
              </div>
            </div>

            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setIsSplitModalOpen(false)}>إلغاء</button>
              <button
                type="button"
                className="adm-btn bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 font-bold transition-colors"
                disabled={actionLoading || !splitAtStopId || !splitNameAAr.trim() || !splitNameBAr.trim()}
                onClick={handleSplitRoute}
              >
                {actionLoading ? '…' : 'تأكيد التقسيم ونشر الخطين'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {isMoveModalOpen && selectedRoute && (
        <div className="adm-overlay" onClick={e => { if (e.target === e.currentTarget) setIsMoveModalOpen(false) }}>
          <div className="adm-dialog" dir="rtl">
            <div className="adm-dialog-header">
              <h3 className="adm-dialog-title">نقل الخط لمدينة أخرى</h3>
              <button type="button" className="adm-detail-close" onClick={() => setIsMoveModalOpen(false)}>✕</button>
            </div>
            <p className="adm-dialog-desc">نقل خط <strong>{selectedRoute.name_ar}</strong> وكل المحطات التابعة له والغير مشتركة مع خطوط أخرى في المدينة الأصلية.</p>
            <div className="adm-dialog-fields">
              <div className="adm-dialog-field">
                <label className="adm-dialog-label font-bold text-xs">المدينة المستهدفة</label>
                <select className="adm-dialog-select" value={targetCityId} onChange={e => setTargetCityId(e.target.value)}>
                  <option value="">اختر مدينة...</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setIsMoveModalOpen(false)}>إلغاء</button>
              <button
                type="button"
                className="adm-btn bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-bold transition-colors"
                disabled={actionLoading || !targetCityId || targetCityId === selectedRoute.city_id}
                onClick={handleMoveRoute}
              >
                {actionLoading ? '…' : 'تأكيد النقل'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`adm-toast ${toast.ok ? 'adm-toast--ok' : 'adm-toast--err'}`}>
          {toast.msg}
        </div>
      )}

      <style>{`
        .adm-shell {
          display: flex; height: 100svh; overflow: hidden;
          background: var(--bg); color: var(--text);
          font-family: var(--font-ar, 'IBM Plex Sans Arabic', sans-serif);
        }

        /* Nav Tabs */
        .adm-nav-tabs {
          display: flex; border-bottom: 1px solid var(--border);
          background: var(--surface); flex-shrink: 0;
        }
        .adm-nav-tab {
          flex: 1; padding: 0.85rem; text-align: center;
          font-size: 0.82rem; font-weight: 700; border-bottom: 2px solid transparent;
          color: var(--muted); cursor: pointer; transition: all 0.15s;
          background: transparent; border-top: none; border-left: none; border-right: none;
          font-family: inherit; outline: none;
        }
        .adm-nav-tab:hover { color: var(--text); background: var(--surface-2); }
        .adm-nav-tab--active {
          color: var(--gold); border-bottom-color: var(--gold);
          background: color-mix(in srgb, var(--gold) 6%, var(--surface));
        }

        /* Activity Logs */
        .adm-log-list {
          display: flex; flex-direction: column; gap: 0.6rem;
          padding: 0.75rem; flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .adm-log-item {
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: 10px; padding: 0.75rem 0.875rem; display: flex;
          flex-direction: column; gap: 0.35rem; text-align: right;
        }
        .adm-log-header {
          display: flex; align-items: center; justify-content: space-between;
        }
        .adm-log-action {
          font-size: 0.67rem; font-weight: 700; padding: 0.15rem 0.5rem;
          border-radius: 20px;
        }
        .adm-log-action--approved { background: color-mix(in srgb, #22c55e 18%, transparent); color: #22c55e; }
        .adm-log-action--disapproved { background: color-mix(in srgb, #ef4444 18%, transparent); color: #ef4444; }
        .adm-log-action--restored { background: color-mix(in srgb, #3b82f6 18%, transparent); color: #3b82f6; }
        .adm-log-action--hidden { background: color-mix(in srgb, #71717a 18%, transparent); color: #71717a; }
        .adm-log-action--combined { background: color-mix(in srgb, #a855f7 18%, transparent); color: #a855f7; }
        .adm-log-action--split { background: color-mix(in srgb, #ec4899 18%, transparent); color: #ec4899; }
        .adm-log-action--moved { background: color-mix(in srgb, #14b8a6 18%, transparent); color: #14b8a6; }
        .adm-log-desc { font-size: 0.8rem; color: var(--text); line-height: 1.5; margin: 0; }
        .adm-log-meta { font-size: 0.72rem; color: var(--muted); display: flex; gap: 0.5rem; }

        /* Modal / Dialog */
        .adm-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
          padding: 1.5rem;
        }
        .adm-dialog {
          width: 100%; max-width: 500px; background: var(--surface);
          border: 1px solid var(--border); border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4); display: flex;
          flex-direction: column; gap: 1rem; padding: 1.5rem;
        }
        .adm-dialog-header {
          display: flex; align-items: center; justify-content: space-between;
        }
        .adm-dialog-title { font-size: 1.05rem; font-weight: 800; color: var(--gold); margin: 0; }
        .adm-dialog-desc { font-size: 0.78rem; color: var(--muted); margin: 0; }
        .adm-dialog-fields { display: flex; flex-direction: column; gap: 0.8rem; }
        .adm-dialog-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .adm-dialog-label { font-size: 0.78rem; font-weight: 600; color: var(--text); }
        .adm-dialog-input, .adm-dialog-select {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); font-family: inherit;
          font-size: 0.85rem; padding: 0.55rem 0.75rem; outline: none;
          transition: border-color 0.15s;
        }
        .adm-dialog-input:focus, .adm-dialog-select:focus { border-color: var(--gold); }
        .adm-dialog-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }

        /* Sidebar */
        .adm-sidebar {
          width: 420px; flex-shrink: 0; display: flex; flex-direction: column;
          border-left: 1px solid var(--border); background: var(--surface);
          overflow: hidden;
        }
        .adm-sidebar-header {
          flex-shrink: 0; padding: 1.25rem 1.25rem 1rem;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .adm-title    { font-size: 1.1rem; font-weight: 800; color: var(--gold); margin: 0 0 0.2rem; }
        .adm-subtitle { font-size: 0.78rem; color: var(--muted); margin: 0; }

        /* Stats */
        .adm-stats {
          display: flex; gap: 0; flex-shrink: 0;
          border-bottom: 1px solid var(--border);
        }
        .adm-stat {
          flex: 1; display: flex; flex-direction: column; align-items: center;
          padding: 0.75rem 0.5rem; border-left: 1px solid var(--border);
          gap: 0.15rem;
        }
        .adm-stat:last-child { border-left: none; }
        .adm-stat-num { font-size: 1.25rem; font-weight: 800; }
        .adm-stat-label { font-size: 0.67rem; color: var(--muted); text-align: center; }
        .adm-stat--pending  .adm-stat-num { color: #f59e0b; }
        .adm-stat--approved .adm-stat-num { color: #22c55e; }
        .adm-stat--rejected .adm-stat-num { color: #ef4444; }

        /* Filters */
        .adm-filters {
          flex-shrink: 0; padding: 0.75rem 1rem;
          border-bottom: 1px solid var(--border);
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .adm-status-tabs { display: flex; gap: 0.25rem; }
        .adm-tab {
          flex: 1; padding: 0.35rem 0.25rem; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted); font-family: inherit; font-size: 0.75rem; font-weight: 500;
          cursor: pointer; transition: all 0.12s; white-space: nowrap;
        }
        .adm-tab:hover { background: var(--surface-2); }
        .adm-tab--active { background: var(--gold); border-color: var(--gold); color: var(--bg); font-weight: 700; }
        .adm-select-wrap { position: relative; }
        .adm-select {
          width: 100%; padding: 0.4rem 1.5rem 0.4rem 0.7rem;
          background: var(--bg); border: 1px solid var(--border); border-radius: 7px;
          color: var(--text); font-family: inherit; font-size: 0.8rem;
          appearance: none; cursor: pointer; outline: none;
        }
        .adm-select:focus { border-color: var(--gold); }
        .adm-select-icon {
          position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%);
          pointer-events: none; color: var(--muted);
        }

        /* Draft list */
        .adm-list { flex: 1; overflow-y: auto; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .adm-empty { text-align: center; color: var(--muted); font-size: 0.85rem; padding: 2rem; line-height: 1.6; }
        .adm-empty--error { color: #ef4444; }
        .adm-empty-detail { font-size: 0.72rem; color: var(--muted); word-break: break-all; }

        .adm-draft-item {
          display: flex; flex-direction: column; gap: 0.3rem;
          padding: 0.75rem 0.875rem; border-radius: 10px;
          border: 1px solid var(--border); background: var(--surface-2);
          cursor: pointer; text-align: right; width: 100%;
          font-family: inherit; transition: all 0.12s;
        }
        .adm-draft-item:hover { border-color: var(--gold); background: var(--bg); }
        .adm-draft-item--active { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 8%, var(--bg)); }
        .adm-draft-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
        .adm-draft-name { font-size: 0.9rem; font-weight: 700; color: var(--text); flex: 1; text-align: right; }
        .adm-draft-meta { font-size: 0.72rem; color: var(--muted); display: flex; flex-wrap: wrap; gap: 0.2rem; }
        .adm-meta-sep { opacity: 0.4; }
        .adm-rejection-reason { font-size: 0.72rem; color: #ef4444; font-style: italic; margin: 0; text-align: right; }

        /* Status badges */
        .adm-badge {
          font-size: 0.67rem; font-weight: 700; padding: 0.15rem 0.5rem;
          border-radius: 20px; flex-shrink: 0;
        }
        .adm-badge--pending  { background: color-mix(in srgb, #f59e0b 18%, transparent); color: #f59e0b; }
        .adm-badge--approved { background: color-mix(in srgb, #22c55e 18%, transparent); color: #22c55e; }
        .adm-badge--rejected { background: color-mix(in srgb, #ef4444 18%, transparent); color: #ef4444; }

        /* Map panel */
        .adm-map-panel { flex: 1; position: relative; background: #111; overflow: hidden; }
        .adm-map { position: absolute; inset: 0; }

        .adm-map-hint {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 10px; padding: 0.875rem 1.25rem;
          font-size: 0.85rem; color: var(--muted); pointer-events: none;
          white-space: nowrap; z-index: 5;
        }

        /* Detail card */
        .adm-detail {
          position: absolute; bottom: 1.25rem; right: 1.25rem; z-index: 10;
          width: 380px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column;
          gap: 0.875rem; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .adm-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
        .adm-detail-title { font-size: 1rem; font-weight: 800; color: var(--text); margin: 0; text-align: right; }
        .adm-detail-subtitle { font-size: 0.75rem; color: var(--muted); margin: 0.15rem 0 0; text-align: right; }
        .adm-detail-close {
          border: none; background: transparent; font-size: 0.85rem;
          color: var(--muted); cursor: pointer; padding: 0.2rem;
          line-height: 1; transition: color 0.1s;
        }
        .adm-detail-close:hover { color: var(--text); }
        .adm-detail-rows { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 0.75rem 0; }
        .adm-detail-row { display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--text); }
        .adm-detail-label { color: var(--muted); font-weight: 500; }
        .adm-detail-hint { font-size: 0.67rem; color: var(--muted); text-align: center; }

        .adm-detail-actions { display: flex; gap: 0.5rem; }
        .adm-btn {
          padding: 0.55rem 1rem; border-radius: 8px; border: 1px solid transparent;
          font-family: inherit; font-size: 0.82rem; font-weight: 700;
          cursor: pointer; transition: all 0.12s; text-align: center;
        }
        .adm-btn--approve { background: var(--gold); color: var(--bg); }
        .adm-btn--approve:hover:not(:disabled) { opacity: 0.9; }
        .adm-btn--reject { background: transparent; border-color: #ef4444; color: #ef4444; }
        .adm-btn--reject:hover:not(:disabled) { background: #ef4444; color: #fff; }
        .adm-btn--ghost { background: transparent; border-color: var(--border); color: var(--text); }
        .adm-btn--ghost:hover { background: var(--surface-2); }
        .adm-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .adm-status-resolved {
          padding: 0.6rem; border-radius: 8px; font-size: 0.8rem; font-weight: 700;
          text-align: center; display: flex; flex-direction: column; gap: 0.35rem;
        }
        .adm-status-resolved--approved { background: color-mix(in srgb, #22c55e 12%, transparent); color: #22c55e; }
        .adm-status-resolved--rejected { background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; }
        .adm-resolved-reason { font-size: 0.72rem; color: var(--muted); font-weight: 500; margin: 0; }

        /* Logout button */
        .adm-logout-btn {
          background: transparent; border: 1px solid var(--border);
          border-radius: 8px; color: var(--muted); padding: 0.4rem;
          cursor: pointer; transition: all 0.12s; display: flex; align-items: center; justify-content: center;
        }
        .adm-logout-btn:hover { color: #ef4444; border-color: #ef4444; }

        /* Login screen */
        .adm-login-shell {
          display: flex; align-items: center; justify-content: center;
          min-height: 100svh; background: var(--bg);
          font-family: var(--font-ar, 'IBM Plex Sans Arabic', sans-serif);
          padding: 1.5rem;
        }
        .adm-login-card {
          width: 100%; max-width: 360px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem 1.75rem;
          display: flex; flex-direction: column; gap: 1.1rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .adm-login-logo-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; text-align: center; }
        .adm-login-title { font-size: 1.25rem; font-weight: 900; color: var(--gold); margin: 0; }
        .adm-login-subtitle { font-size: 0.78rem; color: var(--muted); margin: 0; }
        .adm-login-fields { display: flex; flex-direction: column; gap: 0.85rem; }
        .adm-login-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .adm-login-label { font-size: 0.8rem; font-weight: 600; color: var(--text); }
        .adm-login-input {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); font-family: inherit;
          font-size: 0.9rem; padding: 0.6rem 0.75rem; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .adm-login-input:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 15%, transparent);
        }
        .adm-login-error { font-size: 0.8rem; color: #ef4444; margin: 0; }
        .adm-login-btn {
          width: 100%; padding: 0.7rem; border-radius: 9px;
          border: none; background: var(--gold); color: var(--bg);
          font-family: inherit; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s; margin-top: 0.25rem;
        }
        .adm-login-btn:hover:not(:disabled) { opacity: 0.87; }
        .adm-login-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Mobile back button — hidden on desktop */
        .adm-mobile-back { display: none; }

        /* MapLibre controls */
        .maplibregl-ctrl-group {
          background-color: var(--surface) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important; overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25) !important;
        }
        .maplibregl-ctrl-group button {
          width: 34px !important; height: 34px !important;
          background-color: transparent !important; border: none !important;
        }
        .maplibregl-ctrl-group button:hover { background-color: var(--surface-2) !important; }
        .maplibregl-ctrl-group button + button { border-top: 1px solid var(--border) !important; }

        /* ── Mobile layout ──────────────────────────────────────────────────── */
        @media (max-width: 767px) {
          .adm-shell { flex-direction: column; }

          /* Sidebar fills screen in list view */
          .adm-sidebar {
            width: 100%; border-left: none;
            border-bottom: 1px solid var(--border);
          }

          /* List view: full-screen sidebar, map hidden */
          .adm-shell:not(.adm-shell--map-view) .adm-sidebar   { flex: 1; overflow: hidden; }
          .adm-shell:not(.adm-shell--map-view) .adm-map-panel { display: none; }

          /* Map view: full-screen map, sidebar hidden */
          .adm-shell--map-view .adm-sidebar   { display: none; }
          .adm-shell--map-view .adm-map-panel { flex: 1; }

          /* Back button */
          .adm-mobile-back {
            display: flex; align-items: center; gap: 0.45rem;
            position: absolute; top: 0.75rem; right: 0.75rem; z-index: 10;
            padding: 0.45rem 0.875rem; border-radius: 20px;
            border: 1px solid var(--border); background: var(--surface);
            color: var(--text); font-family: inherit; font-size: 0.82rem; font-weight: 600;
            cursor: pointer; box-shadow: 0 2px 10px rgba(0,0,0,0.25);
            touch-action: manipulation;
          }

          /* Stats bar — tighter on mobile */
          .adm-stat { padding: 0.6rem 0.25rem; }
          .adm-stat-num { font-size: 1.1rem; }

          /* Filters — compact */
          .adm-filters { padding: 0.6rem 0.75rem; }
          .adm-tab { font-size: 0.7rem; padding: 0.3rem 0.2rem; }

          /* List */
          .adm-list { padding: 0.6rem; }

          /* Detail overlay — full-width bottom sheet on mobile */
          .adm-detail {
            bottom: 0; left: 0; right: 0;
            transform: none;
            width: 100%;
            border-radius: 16px 16px 0 0;
            border-bottom: none;
            max-height: 60vh; overflow-y: auto;
          }

          /* Toast above detail card */
          .adm-toast { bottom: 4rem; }
        }
      `}</style>
      {/* Combine State Variables Helper */}
      <CombineStateHelper
        combineCityId={combineCityId}
        setCombineRouteAId={setCombineRouteAId}
        setCombineRouteBId={setCombineRouteBId}
        publishedRoutes={publishedRoutes}
      />
    </div>
  )
}

// Helper component to bind dependent state updates to avoid React render errors
function CombineStateHelper({
  combineCityId,
  setCombineRouteAId,
  setCombineRouteBId,
  publishedRoutes,
}: {
  combineCityId: string
  setCombineRouteAId: (v: string) => void
  setCombineRouteBId: (v: string) => void
  publishedRoutes: PublishedRoute[]
}) {
  useEffect(() => {
    if (!combineCityId) return
    const cityRoutes = publishedRoutes.filter(r => r.city_id === combineCityId && r.status === 'published')
    setCombineRouteAId(cityRoutes[0]?.id || '')
    setCombineRouteBId(cityRoutes[1]?.id || '')
  }, [combineCityId, publishedRoutes, setCombineRouteAId, setCombineRouteBId])
  return null
}

// ─── Additional Types ─────────────────────────────────────────────────────────
type AdminTab = 'drafts' | 'routes' | 'logs'

interface PublishedRoute {
  id: string
  city_id: string
  city: { name_ar: string; name_en: string } | null
  name_ar: string
  name_en: string | null
  price_old: number | null
  price_new: number | null
  status: 'published' | 'disapproved' | 'hidden'
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
