'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { FeatureCollection } from 'geojson'
import { useQueryClient } from '@tanstack/react-query'
import { useAdminDrafts, useMapData } from '../_hooks/useMapData'
import TransitLayout from '../layout'
import { router, Head } from '@inertiajs/react'

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
  return draft.geojson?.features?.filter((f: any) => f.geometry?.type === 'Point').length ?? 0
}



// ─── Component ────────────────────────────────────────────────────────────────
function TransitAdminPageContent() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const [mapReady,       setMapReady]       = useState(false)
  const [selectedDraft,  setSelectedDraft]  = useState<Draft | null>(null)
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all')
  const [cityFilter,     setCityFilter]     = useState('all')
  const [rejectOpen,     setRejectOpen]     = useState(false)
  const [rejectReason,   setRejectReason]   = useState('')
  const [actionLoading,  setActionLoading]  = useState(false)
  const [toast,          setToast]          = useState<{ msg: string; ok: boolean } | null>(null)
  const [mobileView,     setMobileView]     = useState<'list' | 'map'>('list')

  const { data: drafts = [], isLoading, error: draftsError } = useAdminDrafts()

  const { data: refData } = useMapData(selectedDraft?.city_id)
  const queryClient = useQueryClient()

  // ─── Toast helper ────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, ok = true) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ─── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: '/styles/styles/dark-matter.json',
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
        filter: ['==', ['geometry-type'], 'LineString'],
      })
      map.addLayer({
        id: 'draft-points', type: 'circle', source: 'draft-source',
        paint: { 'circle-radius': 7, 'circle-color': '#ef4444', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' },
        filter: ['==', ['geometry-type'], 'Point'],
      })

      mapRef.current = map
      setMapReady(true)
    })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ─── Update draft layer when selection changes ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const src = mapRef.current.getSource('draft-source') as maplibregl.GeoJSONSource | undefined
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    src?.setData(selectedDraft?.geojson ?? empty)

    if (selectedDraft) {
      const line = selectedDraft.geojson?.features?.find((f: any) => f.geometry?.type === 'LineString')
      if (line) {
        const coords: [number, number][] = line.geometry.coordinates
        const bounds = coords.reduce(
          (b, c) => b.extend(c as maplibregl.LngLatLike),
          new maplibregl.LngLatBounds(coords[0], coords[0])
        )
        mapRef.current.fitBounds(bounds, { padding: 80 })
      }
    }
  }, [mapReady, selectedDraft])

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
        headers: { 'Content-Type': 'application/json' },
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

  // ─── Derived data ────────────────────────────────────────────────────────────
  const stats = {
    pending:  drafts.filter((d: Draft) => d.status === 'pending').length,
    approved: drafts.filter((d: Draft) => d.status === 'approved').length,
    rejected: drafts.filter((d: Draft) => d.status === 'rejected').length,
  }

  const uniqueCities = Array.from(new Set(drafts.map((d: Draft) => d.city_id))) as string[]

  const filtered: Draft[] = drafts
    .filter((d: Draft) => statusFilter === 'all' || d.status === statusFilter)
    .filter((d: Draft) => cityFilter === 'all' || d.city_id === cityFilter)
    .sort((a: Draft, b: Draft) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const handleLogout = useCallback(() => {
    router.post('/logout')
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className={`adm-shell${mobileView === 'map' ? ' adm-shell--map-view' : ''}`} dir="rtl">

      {/* Sidebar */}
      <aside className="adm-sidebar">
        <header className="adm-sidebar-header">
          <div>
            <h1 className="adm-title">لوحة الإدارة</h1>
            <p className="adm-subtitle">مراجعة مسارات المجتمع</p>
          </div>
          <button type="button" className="adm-logout-btn" onClick={handleLogout} title="تسجيل الخروج">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
          </button>
        </header>

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
          ) : filtered.length === 0 ? (
            <div className="adm-empty">لا توجد نتائج</div>
          ) : filtered.map((draft: Draft) => (
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

        {/* Detail overlay */}
        {selectedDraft && (
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

        {/* Empty state hint */}
        {!selectedDraft && (
          <div className="adm-map-hint">
            اختر مسودة من القائمة لمعاينتها على الخريطة
          </div>
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
            <p className="adm-dialog-desc">
              أضف سبب الرفض — سيظهر للمساهم ليتمكن من التحسين.
            </p>
            <textarea
              className="adm-textarea"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="سبب الرفض (اختياري)…"
              rows={4}
              autoFocus
            />
            <div className="adm-dialog-actions">
              <button type="button" className="adm-btn adm-btn--ghost" onClick={() => setRejectOpen(false)}>
                إلغاء
              </button>
              <button
                type="button"
                className="adm-btn adm-btn--reject"
                disabled={actionLoading}
                onClick={handleRejectConfirm}
              >
                {actionLoading ? '…' : 'تأكيد الرفض'}
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
          font-family: var(--font-ar, 'Cairo', sans-serif);
        }

        /* Sidebar */
        .adm-sidebar {
          width: 420px; flex-shrink: 0; display: flex; flex-direction: column;
          border-left: 1px solid var(--border); background: var(--surface);
          overflow: hidden;
        }
        .adm-sidebar-header {
          flex-shrink: 0; padding: 1.25rem 1.25rem 1rem;
          border-bottom: 1px solid var(--border);
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
          white-space: nowrap;
        }

        /* Detail overlay */
        .adm-detail {
          position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
          width: min(420px, calc(100% - 2rem));
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 12px; padding: 1.25rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.35);
          display: flex; flex-direction: column; gap: 0.875rem;
        }
        .adm-detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 0.5rem; }
        .adm-detail-title  { font-size: 1rem; font-weight: 800; color: var(--text); margin: 0; }
        .adm-detail-subtitle { font-size: 0.78rem; color: var(--muted); margin: 0.15rem 0 0; }
        .adm-detail-close {
          width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
          background: var(--surface-2); border: 1px solid var(--border);
          color: var(--muted); cursor: pointer; font-size: 0.75rem;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.12s;
        }
        .adm-detail-close:hover { color: var(--text); background: var(--border); }
        .adm-detail-rows { display: flex; flex-direction: column; gap: 0.4rem; }
        .adm-detail-row { display: flex; gap: 0.5rem; font-size: 0.82rem; }
        .adm-detail-label { color: var(--muted); min-width: 70px; flex-shrink: 0; }
        .adm-detail-hint {
          font-size: 0.72rem; color: var(--muted);
          border-top: 1px solid var(--border); padding-top: 0.625rem;
        }
        .adm-detail-actions { display: flex; gap: 0.5rem; }

        .adm-status-resolved {
          font-size: 0.82rem; font-weight: 600; padding: 0.5rem 0.75rem;
          border-radius: 8px; text-align: center;
        }
        .adm-status-resolved--approved { background: color-mix(in srgb, #22c55e 12%, transparent); color: #22c55e; }
        .adm-status-resolved--rejected { background: color-mix(in srgb, #ef4444 12%, transparent); color: #ef4444; }
        .adm-resolved-reason { font-size: 0.75rem; font-weight: 400; color: var(--muted); margin: 0.3rem 0 0; font-style: italic; }

        /* Buttons */
        .adm-btn {
          flex: 1; padding: 0.55rem 0.75rem; border-radius: 8px;
          font-family: inherit; font-size: 0.85rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.12s; border: none;
        }
        .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-btn--approve { background: #16a34a; color: #fff; }
        .adm-btn--approve:not(:disabled):hover { opacity: 0.88; }
        .adm-btn--reject  { background: #dc2626; color: #fff; }
        .adm-btn--reject:not(:disabled):hover  { opacity: 0.88; }
        .adm-btn--ghost {
          background: transparent; color: var(--muted);
          border: 1px solid var(--border);
        }
        .adm-btn--ghost:hover { background: var(--surface-2); color: var(--text); }

        /* Dialog */
        .adm-overlay {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(2px);
          display: flex; align-items: center; justify-content: center;
        }
        .adm-dialog {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 14px; padding: 1.5rem;
          width: min(440px, calc(100vw - 2rem));
          box-shadow: 0 16px 48px rgba(0,0,0,0.4);
          display: flex; flex-direction: column; gap: 1rem;
        }
        .adm-dialog-header { display: flex; align-items: center; justify-content: space-between; }
        .adm-dialog-title  { font-size: 1rem; font-weight: 800; color: var(--text); margin: 0; }
        .adm-dialog-desc   { font-size: 0.82rem; color: var(--muted); margin: 0; line-height: 1.6; }
        .adm-textarea {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); font-family: inherit;
          font-size: 0.85rem; padding: 0.6rem 0.75rem; resize: vertical;
          outline: none; transition: border-color 0.15s;
        }
        .adm-textarea:focus { border-color: var(--gold); }
        .adm-textarea::placeholder { color: var(--muted); opacity: 0.65; }
        .adm-dialog-actions { display: flex; gap: 0.5rem; }

        /* Toast */
        .adm-toast {
          position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
          z-index: 100; padding: 0.65rem 1.25rem; border-radius: 10px;
          font-family: inherit; font-size: 0.875rem; font-weight: 600;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          animation: adm-toast-in 0.25s cubic-bezier(.34,1.56,.64,1) both;
        }
        @keyframes adm-toast-in { from{opacity:0;transform:translate(-50%,10px)} to{opacity:1;transform:translate(-50%,0)} }
        .adm-toast--ok  { background: rgba(21,128,61,0.96); color: #dcfce7; }
        .adm-toast--err { background: rgba(153,27,27,0.96); color: #fee2e2; }

        /* Logout button */
        .adm-sidebar-header { display: flex; align-items: flex-start; justify-content: space-between; }
        .adm-logout-btn {
          width: 30px; height: 30px; border-radius: 7px; flex-shrink: 0;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted); cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: all 0.12s;
        }
        .adm-logout-btn:hover { color: #ef4444; border-color: #ef4444; }

        /* Login screen */
        .adm-login-shell {
          display: flex; align-items: center; justify-content: center;
          min-height: 100svh; background: var(--bg);
          font-family: var(--font-ar, 'Cairo', sans-serif);
          padding: 1.5rem;
        }
        .adm-login-card {
          width: 100%; max-width: 360px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 16px; padding: 2rem 1.75rem;
          display: flex; flex-direction: column; gap: 1.1rem;
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        }
        .adm-login-brand { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.25rem; }
        .adm-login-logo  { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.1em; color: var(--gold); text-transform: uppercase; }
        .adm-login-title { font-size: 1.15rem; font-weight: 800; color: var(--text); margin: 0; }
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
    </div>
  )
}

export default function TransitAdminPage() {
  return (
    <TransitLayout>
      <Head>
        <title>لوحة التحكم بالترانزيت</title>
        <meta name="description" content="مراجعة وتدقيق خطوط ومحطات النقل المقترحة من قبل المساهمين في منصة ترانزيت." />
      </Head>
      <TransitAdminPageContent />
    </TransitLayout>
  )
}
