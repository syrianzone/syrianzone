'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { FeatureCollection, Feature, LineString, Point, Position } from 'geojson'

// ─── Types ────────────────────────────────────────────────────────────────────
type DrawMode = 'idle' | 'line' | 'point'
type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; msg: string; type: ToastType }

const MODE_HINTS: Record<DrawMode, string> = {
  idle:  'اختر أداة رسم من الأزرار أدناه للبدء',
  line:  'انقر لإضافة نقاط المسار • انقر مرتين لإنهاء الخط • Esc للإلغاء',
  point: 'انقر على الخريطة لإضافة محطة توقف • Esc للإلغاء',
}

// Source / layer IDs
const SRC_LINES    = 'studio-lines'
const SRC_STOPS    = 'studio-stops'
const SRC_ACTIVE   = 'studio-active'
const LYR_LINES    = 'studio-layer-lines'
const LYR_STOPS    = 'studio-layer-stops'
const LYR_VERTICES = 'studio-layer-vertices'
const LYR_ACTIVE   = 'studio-layer-active'
const LYR_PREVIEW  = 'studio-layer-preview'

// ─── Component ────────────────────────────────────────────────────────────────
export default function TransitStudioPage() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<maplibregl.Map | null>(null)
  const modeRef      = useRef<DrawMode>('idle')         // sync ref for event handlers
  const activeLine   = useRef<Position[]>([])           // coords of line being drawn

  // form state
  const [cityId, setCityId] = useState('city-damascus')
  const [nameAr, setNameAr] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [price,  setPrice]  = useState('')
  const [notes,  setNotes]  = useState('')

  // ui state
  const [mapReady,      setMapReady]      = useState(false)
  const [drawMode,      setDrawMode]      = useState<DrawMode>('idle')
  const [lineCount,     setLineCount]     = useState(0)
  const [stopCount,     setStopCount]     = useState(0)
  const [submitting,    setSubmitting]    = useState(false)
  const [toasts,        setToasts]        = useState<Toast[]>([])

  // drawn features stored in refs (sources updated directly)
  const drawnLines = useRef<Feature<LineString>[]>([])
  const drawnStops = useRef<Feature<Point>[]>([])

  const router = useRouter()

  // ─── Toast ─────────────────────────────────────────────────────────────────
  const addToast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  // ─── Source helpers ─────────────────────────────────────────────────────────
  const flushLines = useCallback(() => {
    const map = mapRef.current; if (!map) return
    const src = map.getSource(SRC_LINES) as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: drawnLines.current })
    setLineCount(drawnLines.current.length)
  }, [])

  const flushStops = useCallback(() => {
    const map = mapRef.current; if (!map) return
    const src = map.getSource(SRC_STOPS) as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: drawnStops.current })
    setStopCount(drawnStops.current.length)
  }, [])

  const flushActive = useCallback((coords: Position[], cursor?: Position) => {
    const map = mapRef.current; if (!map) return
    const src = map.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    const features: Feature[] = []
    const allCoords = cursor && coords.length > 0 ? [...coords, cursor] : coords
    if (allCoords.length >= 2) {
      features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: allCoords } })
    }
    // vertex dots
    coords.forEach(c => features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
    src.setData({ type: 'FeatureCollection', features })
  }, [])

  const clearActive = useCallback(() => {
    const map = mapRef.current; if (!map) return
    const src = map.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: [] })
    activeLine.current = []
  }, [])

  // ─── Mode switching ─────────────────────────────────────────────────────────
  const setMode = useCallback((mode: DrawMode) => {
    clearActive()
    modeRef.current = mode
    setDrawMode(mode)
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = mode !== 'idle' ? 'crosshair' : ''
  }, [clearActive])

  // ─── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: '/styles/styles/dark-matter.json',
      center: [36.2913, 33.5138],
      zoom: 12,
      attributionControl: false,
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new maplibregl.NavigationControl(), 'bottom-right')

    map.on('load', () => {
      // ── Add sources ──────────────────────────────────────────────────────
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

      map.addSource(SRC_LINES,  { type: 'geojson', data: empty })
      map.addSource(SRC_STOPS,  { type: 'geojson', data: empty })
      map.addSource(SRC_ACTIVE, { type: 'geojson', data: empty })

      // ── Completed lines ──────────────────────────────────────────────────
      map.addLayer({
        id: LYR_LINES,
        type: 'line',
        source: SRC_LINES,
        paint: {
          'line-color': '#f5a623',
          'line-width': 3,
          'line-opacity': 0.9,
        },
      })

      // ── Completed stops ──────────────────────────────────────────────────
      map.addLayer({
        id: LYR_STOPS,
        type: 'circle',
        source: SRC_STOPS,
        paint: {
          'circle-radius': 7,
          'circle-color': '#4a9eff',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      })

      // ── Active line (preview) ────────────────────────────────────────────
      map.addLayer({
        id: LYR_ACTIVE,
        type: 'line',
        source: SRC_ACTIVE,
        filter: ['==', '$type', 'LineString'],
        paint: {
          'line-color': '#f5a623',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
          'line-opacity': 0.8,
        },
      })

      // ── Vertex dots on active line ───────────────────────────────────────
      map.addLayer({
        id: LYR_VERTICES,
        type: 'circle',
        source: SRC_ACTIVE,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#f5a623',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
        },
      })

      mapRef.current = map
      setMapReady(true)
    })

    // ── Click: add vertex or stop ─────────────────────────────────────────
    map.on('click', (e) => {
      const mode = modeRef.current
      const coord: Position = [e.lngLat.lng, e.lngLat.lat]

      if (mode === 'line') {
        activeLine.current = [...activeLine.current, coord]
        flushActive(activeLine.current)
      } else if (mode === 'point') {
        const feature: Feature<Point> = {
          type: 'Feature',
          properties: { type: 'stop', id: Date.now() },
          geometry: { type: 'Point', coordinates: coord },
        }
        drawnStops.current = [...drawnStops.current, feature]
        flushStops()
      }
    })

    // ── Double-click: finish line ─────────────────────────────────────────
    map.on('dblclick', (e) => {
      e.preventDefault() // prevent map zoom
      if (modeRef.current !== 'line') return
      const coords = activeLine.current
      if (coords.length >= 2) {
        // drop the duplicate click vertex added by the preceding single-click
        const finalCoords = coords.slice(0, -1)
        if (finalCoords.length >= 2) {
          const feature: Feature<LineString> = {
            type: 'Feature',
            properties: { type: 'route', id: Date.now() },
            geometry: { type: 'LineString', coordinates: finalCoords },
          }
          drawnLines.current = [...drawnLines.current, feature]
          flushLines()
        }
      }
      activeLine.current = []
      flushActive([])
      // stay in line mode so user can draw another segment
    })

    // ── Mouse move: live preview ──────────────────────────────────────────
    map.on('mousemove', (e) => {
      if (modeRef.current !== 'line' || activeLine.current.length === 0) return
      const cursor: Position = [e.lngLat.lng, e.lngLat.lat]
      flushActive(activeLine.current, cursor)
    })

    // ── Esc key: cancel active draw ───────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activeLine.current = []
        const src = map.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: [] })
        modeRef.current = 'idle'
        setDrawMode('idle')
        map.getCanvas().style.cursor = ''
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ─── Clear all ─────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    drawnLines.current = []
    drawnStops.current = []
    activeLine.current = []
    flushLines()
    flushStops()
    clearActive()
    setMode('idle')
    addToast('تم مسح جميع الرسومات', 'info')
  }, [flushLines, flushStops, clearActive, setMode, addToast])

  // ─── Undo last vertex ───────────────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (drawMode === 'line' && activeLine.current.length > 0) {
      activeLine.current = activeLine.current.slice(0, -1)
      flushActive(activeLine.current)
    } else if (drawnLines.current.length > 0 || drawnStops.current.length > 0) {
      // undo last completed feature
      if (drawnStops.current.length > 0) {
        drawnStops.current = drawnStops.current.slice(0, -1)
        flushStops()
      } else {
        drawnLines.current = drawnLines.current.slice(0, -1)
        flushLines()
      }
    }
  }, [drawMode, flushActive, flushLines, flushStops])

  // ─── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const totalFeatures = drawnLines.current.length + drawnStops.current.length
    if (totalFeatures === 0) {
      addToast('الرجاء رسم المسار على الخريطة أولاً', 'error'); return
    }
    if (!nameAr.trim()) {
      addToast('اسم المسار بالعربية مطلوب', 'error'); return
    }

    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [...drawnLines.current, ...drawnStops.current],
    }

    setSubmitting(true)
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${baseUrl}/api/v1/studio/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id: cityId,
          name_ar: nameAr.trim(),
          name_en: nameEn.trim() || null,
          price:   parseInt(price) || null,
          notes:   notes.trim() || null,
          geojson,
        }),
      })
      if (res.ok) {
        addToast('تم تقديم المسار بنجاح! سيُراجَع من قِبَل الفريق.', 'success')
        setTimeout(() => router.push('/transit'), 2000)
      } else {
        const err = await res.json().catch(() => ({}))
        addToast('حدث خطأ: ' + (err.message || `HTTP ${res.status}`), 'error')
      }
    } catch {
      addToast('تعذّر الاتصال بالخادم', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const featureCount = lineCount + stopCount

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="studio-shell" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="studio-header">
        <div className="studio-header-inner">
          <div className="studio-header-brand">
            <Link href="/transit" className="studio-back-btn" aria-label="العودة">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </Link>
            <div className="studio-title-group">
              <span className="studio-brand-label">SYRIAN.ZONE</span>
              <span className="studio-brand-sep">/</span>
              <h1 className="studio-title">استوديو النقل</h1>
            </div>
          </div>
          <div className="studio-header-status">
            <span className={`studio-dot ${mapReady ? 'studio-dot--ready' : 'studio-dot--loading'}`} />
            <span className="studio-status-text">{mapReady ? 'الخريطة جاهزة' : 'تحميل الخريطة…'}</span>
          </div>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="studio-body">

        {/* Sidebar */}
        <aside className="studio-sidebar">
          <div className="studio-sidebar-inner">

            {/* Draw tools */}
            <div className="studio-draw-panel">
              <div className="studio-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                </svg>
                أدوات الرسم
              </div>

              <div className="studio-tool-btns">
                <button
                  type="button"
                  onClick={() => setMode(drawMode === 'line' ? 'idle' : 'line')}
                  className={`studio-tool-btn ${drawMode === 'line' ? 'studio-tool-btn--active-line' : ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l18 18M3 21V3h18"/>
                  </svg>
                  رسم مسار
                  {drawMode === 'line' && <span className="studio-tool-pill">نشط</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setMode(drawMode === 'point' ? 'idle' : 'point')}
                  className={`studio-tool-btn ${drawMode === 'point' ? 'studio-tool-btn--active-point' : ''}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  إضافة محطة
                  {drawMode === 'point' && <span className="studio-tool-pill">نشط</span>}
                </button>
              </div>

              {/* Status hint */}
              <p className="studio-hint">{MODE_HINTS[drawMode]}</p>

              {/* Counters */}
              <div className="studio-counters">
                <div className="studio-counter">
                  <span className={`studio-counter-num ${lineCount > 0 ? 'studio-counter-num--line' : ''}`}>{lineCount}</span>
                  <span className="studio-counter-label">خط مسار</span>
                </div>
                <div className="studio-counter-divider" />
                <div className="studio-counter">
                  <span className={`studio-counter-num ${stopCount > 0 ? 'studio-counter-num--stop' : ''}`}>{stopCount}</span>
                  <span className="studio-counter-label">محطة توقف</span>
                </div>
              </div>

              {/* Undo / Clear */}
              <div className="studio-util-btns">
                <button type="button" onClick={handleUndo}  className="studio-util-btn" disabled={featureCount === 0 && activeLine.current.length === 0}>
                  ↩ تراجع
                </button>
                <button type="button" onClick={handleClear} className="studio-util-btn studio-util-btn--danger" disabled={featureCount === 0}>
                  🗑 مسح الكل
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="studio-form">
              <div className="studio-section-label">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                بيانات المسار
              </div>

              <div className="studio-field">
                <label className="studio-label" htmlFor="s-city">المدينة</label>
                <div className="studio-select-wrap">
                  <select id="s-city" value={cityId} onChange={e => setCityId(e.target.value)} className="studio-select">
                    <option value="city-damascus">دمشق</option>
                    <option value="city-aleppo">حلب</option>
                    <option value="city-homs">حمص</option>
                    <option value="city-latakia">اللاذقية</option>
                    <option value="city-hama">حماة</option>
                    <option value="city-tartus">طرطوس</option>
                  </select>
                  <svg className="studio-select-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>

              <div className="studio-field">
                <label className="studio-label" htmlFor="s-name-ar">اسم المسار <span className="studio-req">*</span></label>
                <input id="s-name-ar" required type="text" value={nameAr} onChange={e => setNameAr(e.target.value)}
                  className="studio-input" placeholder="مثال: باب توما — برامكة" />
              </div>

              <div className="studio-field">
                <label className="studio-label" htmlFor="s-name-en">الاسم بالإنجليزية <span className="studio-opt">اختياري</span></label>
                <input id="s-name-en" type="text" value={nameEn} onChange={e => setNameEn(e.target.value)}
                  className="studio-input" placeholder="e.g. Bab Touma — Baramkeh" dir="ltr" />
              </div>

              <div className="studio-field">
                <label className="studio-label" htmlFor="s-price">التعرفة (ل.س)</label>
                <input id="s-price" type="number" min="0" value={price} onChange={e => setPrice(e.target.value)}
                  className="studio-input" placeholder="مثال: 1500" dir="ltr" />
              </div>

              <div className="studio-field">
                <label className="studio-label" htmlFor="s-notes">ملاحظات <span className="studio-opt">اختياري</span></label>
                <textarea id="s-notes" value={notes} onChange={e => setNotes(e.target.value)}
                  className="studio-textarea" placeholder="محطات بارزة، تفاصيل إضافية…" rows={3} />
              </div>

              <button type="submit" className="studio-submit-btn" disabled={submitting}>
                {submitting
                  ? <><span className="studio-spinner" />جاري الإرسال…</>
                  : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>إرسال المسار</>
                }
              </button>
            </form>

            {/* Instructions */}
            <div className="studio-instructions">
              <div className="studio-section-label" style={{ marginBottom: '0.5rem' }}>طريقة الاستخدام</div>
              <ol className="studio-instructions-list">
                <li>اضغط <strong>رسم مسار</strong> ثم انقر على الخريطة لإضافة نقاط الطريق</li>
                <li>انقر <strong>مرتين</strong> لإنهاء الخط والانتقال لرسم خط آخر</li>
                <li>اضغط <strong>إضافة محطة</strong> لوضع محطات التوقف على المسار</li>
                <li>اضغط <strong>Esc</strong> أو انقر على الأداة مجدداً للخروج منها</li>
              </ol>
            </div>

          </div>
        </aside>

        {/* Map */}
        <div className="studio-map-wrapper">
          {!mapReady && (
            <div className="studio-map-loader">
              <div className="studio-loader-ring" />
              <span>تحميل الخريطة…</span>
            </div>
          )}
          <div ref={mapContainer} className="studio-map" />

          {drawMode !== 'idle' && (
            <div className={`studio-mode-badge studio-mode-badge--${drawMode}`}>
              {drawMode === 'line'  && '✏️ رسم مسار — انقر مرتين للإنهاء'}
              {drawMode === 'point' && '📍 إضافة محطة — انقر لوضع محطة'}
            </div>
          )}
        </div>
      </div>

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <div className="studio-toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`studio-toast studio-toast--${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ── Scoped styles ──────────────────────────────────────────────────── */}
      <style>{`
        .studio-shell {
          display: flex; flex-direction: column;
          height: 100svh; overflow: hidden;
          background: var(--bg); color: var(--text);
          font-family: var(--font-ar, 'Cairo', sans-serif);
        }

        /* Header */
        .studio-header {
          flex-shrink: 0; border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .studio-header-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 1.25rem; height: 54px;
        }
        .studio-header-brand { display: flex; align-items: center; gap: 0.75rem; }
        .studio-back-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--gold); transition: background 0.15s; text-decoration: none;
        }
        .studio-back-btn:hover { background: var(--border); }
        .studio-title-group { display: flex; align-items: center; gap: 0.35rem; }
        .studio-brand-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; color: var(--gold); text-transform: uppercase; }
        .studio-brand-sep   { color: var(--muted); font-size: 0.875rem; }
        .studio-title       { font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0; }
        .studio-header-status { display: flex; align-items: center; gap: 0.45rem; }
        .studio-dot { width: 8px; height: 8px; border-radius: 50%; }
        .studio-dot--ready   { background: #22c55e; box-shadow: 0 0 6px #22c55e88; }
        .studio-dot--loading { background: var(--muted); animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .studio-status-text  { font-size: 0.73rem; color: var(--muted); }

        /* Body */
        .studio-body { display: flex; flex: 1; overflow: hidden; }

        /* Sidebar */
        .studio-sidebar {
          width: 320px; flex-shrink: 0;
          border-left: 1px solid var(--border);
          background: var(--surface); overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .studio-sidebar-inner { padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }

        /* Section label */
        .studio-section-label {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--muted); margin-bottom: 0.625rem;
        }

        /* Draw panel */
        .studio-draw-panel {
          border: 1px solid var(--border); border-radius: 10px;
          background: var(--surface-2); padding: 0.875rem;
        }
        .studio-tool-btns { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
        .studio-tool-btn {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.55rem 0.875rem; border-radius: 8px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text); font-family: inherit; font-size: 0.85rem; font-weight: 500;
          cursor: pointer; transition: all 0.15s; position: relative;
        }
        .studio-tool-btn:hover { border-color: var(--border-hover); background: var(--surface); }
        .studio-tool-btn--active-line  { border-color: #f5a623; background: rgba(245,166,35,0.12); color: #f5a623; }
        .studio-tool-btn--active-point { border-color: #4a9eff; background: rgba(74,158,255,0.12); color: #4a9eff; }
        .studio-tool-pill {
          margin-right: auto; font-size: 0.65rem; font-weight: 700;
          padding: 0.1rem 0.45rem; border-radius: 20px;
          background: currentColor; color: var(--bg);
        }

        .studio-hint { font-size: 0.775rem; color: var(--muted); margin: 0 0 0.75rem; line-height: 1.55; }

        /* Counters */
        .studio-counters {
          display: flex; align-items: center; gap: 0.75rem;
          padding: 0.5rem 0.625rem; background: var(--bg);
          border: 1px solid var(--border); border-radius: 8px; margin-bottom: 0.625rem;
        }
        .studio-counter { display: flex; align-items: center; gap: 0.4rem; }
        .studio-counter-num {
          font-size: 1rem; font-weight: 700; color: var(--muted); min-width: 1.5ch; text-align: center;
          transition: color 0.2s;
        }
        .studio-counter-num--line { color: #f5a623; }
        .studio-counter-num--stop { color: #4a9eff; }
        .studio-counter-label { font-size: 0.75rem; color: var(--muted); }
        .studio-counter-divider { width: 1px; height: 24px; background: var(--border); }

        /* Utility buttons */
        .studio-util-btns { display: flex; gap: 0.5rem; }
        .studio-util-btn {
          flex: 1; padding: 0.45rem 0.5rem; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted); font-family: inherit; font-size: 0.78rem; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .studio-util-btn:not(:disabled):hover { background: var(--surface); color: var(--text); }
        .studio-util-btn--danger:not(:disabled):hover { border-color: #ef4444; color: #ef4444; }
        .studio-util-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Form */
        .studio-form { display: flex; flex-direction: column; gap: 0.75rem; }
        .studio-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .studio-label { font-size: 0.8rem; font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 0.3rem; }
        .studio-req { color: #ef4444; }
        .studio-opt { font-size: 0.7rem; color: var(--muted); font-weight: 400; }

        .studio-input, .studio-select, .studio-textarea {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); font-family: inherit;
          font-size: 0.85rem; padding: 0.5rem 0.7rem;
          transition: border-color 0.15s, box-shadow 0.15s; outline: none;
          appearance: none; -webkit-appearance: none;
        }
        .studio-input::placeholder, .studio-textarea::placeholder { color: var(--muted); opacity: 0.65; }
        .studio-input:focus, .studio-select:focus, .studio-textarea:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 15%, transparent);
        }
        .studio-textarea { resize: vertical; }
        .studio-select-wrap { position: relative; }
        .studio-select { padding-left: 1.75rem; cursor: pointer; }
        .studio-select-icon {
          position: absolute; left: 0.6rem; top: 50%; transform: translateY(-50%);
          pointer-events: none; color: var(--muted);
        }

        .studio-submit-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.45rem;
          width: 100%; padding: 0.65rem; border-radius: 9px;
          border: none; background: var(--gold); color: var(--bg);
          font-family: inherit; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s; margin-top: 0.25rem;
        }
        .studio-submit-btn:not(:disabled):hover { opacity: 0.88; }
        .studio-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .studio-spinner {
          width: 15px; height: 15px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Instructions */
        .studio-instructions {
          border: 1px solid var(--border); border-radius: 10px;
          background: var(--surface-2); padding: 0.875rem;
        }
        .studio-instructions-list {
          margin: 0; padding-right: 1.1rem; list-style: decimal;
          display: flex; flex-direction: column; gap: 0.4rem;
        }
        .studio-instructions-list li { font-size: 0.78rem; color: var(--muted); line-height: 1.5; }
        .studio-instructions-list strong { color: var(--text); }

        /* Map */
        .studio-map-wrapper { flex: 1; position: relative; background: #111; }
        .studio-map { position: absolute; inset: 0; }
        .studio-map-loader {
          position: absolute; inset: 0; z-index: 10;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 1rem; background: var(--bg); color: var(--muted); font-size: 0.9rem;
        }
        .studio-loader-ring {
          width: 36px; height: 36px; border-radius: 50%;
          border: 3px solid var(--border); border-top-color: var(--gold);
          animation: spin 0.8s linear infinite;
        }

        .studio-mode-badge {
          position: absolute; top: 1rem; right: 1rem; z-index: 10;
          padding: 0.425rem 0.875rem; border-radius: 20px;
          font-size: 0.8rem; font-weight: 600; font-family: inherit;
          pointer-events: none;
          animation: badge-in 0.2s ease both;
        }
        @keyframes badge-in { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:none} }
        .studio-mode-badge--line  { background: rgba(56,142,60,0.92); color:#fff; }
        .studio-mode-badge--point { background: rgba(25,118,210,0.92); color:#fff; }

        /* Toasts */
        .studio-toasts {
          position: fixed; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
          z-index: 100; display: flex; flex-direction: column; gap: 0.5rem; align-items: center;
          pointer-events: none;
        }
        .studio-toast {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.6rem 1.1rem; border-radius: 10px;
          font-size: 0.875rem; font-weight: 500; font-family: inherit;
          min-width: 220px; max-width: 400px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
          animation: toast-in 0.25s cubic-bezier(.34,1.56,.64,1) both;
        }
        @keyframes toast-in { from{opacity:0;transform:translateY(12px) scale(0.95)} to{opacity:1;transform:none} }
        .studio-toast--success { background: rgba(21,128,61,0.96); color:#dcfce7; }
        .studio-toast--error   { background: rgba(153,27,27,0.96);  color:#fee2e2; }
        .studio-toast--info    { background: rgba(30,58,138,0.96);  color:#dbeafe; }

        /* MapLibre control overrides — use background-color NOT background shorthand */
        .maplibregl-ctrl-group {
          background-color: var(--surface) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important; overflow: hidden;
          box-shadow: 0 2px 12px rgba(0,0,0,0.25) !important;
        }
        .maplibregl-ctrl-group button {
          width: 36px !important; height: 36px !important;
          background-color: transparent !important; border: none !important;
        }
        .maplibregl-ctrl-group button:hover { background-color: var(--surface-2) !important; }
        .maplibregl-ctrl-group button + button { border-top: 1px solid var(--border) !important; }
      `}</style>
    </div>
  )
}
