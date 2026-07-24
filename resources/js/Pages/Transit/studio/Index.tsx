'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { router, Link, Head } from '@inertiajs/react'
import type { FeatureCollection, Position } from 'geojson'
import { useStudioStore, type StopFeature, type WizardStep } from '../_store/useStudioStore'
import { useMapData } from '../_hooks/useMapData'
import cities from '../_data/cities.json'
import TransitLayout from '../layout'
import { useTransitTheme } from '../_components/TransitThemeContext'
import { useAuth } from '@/Contexts/AuthContext'

// ─── Types ────────────────────────────────────────────────────────────────────
type DrawMode = 'idle' | 'line' | 'point'
type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; msg: string; type: ToastType }

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

// Find nearest point on a line segment (ax,ay)→(bx,by) from point (px,py)
function nearestOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { x: ax, y: ay, t: 0 }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return { x: ax + t * dx, y: ay + t * dy, t }
}

// Find the nearest segment in a polyline and return insertion index + pixel distance
function findNearestSegment(coords: [number, number][], px: number, py: number, map: maplibregl.Map) {
  let minDist = Infinity
  let insertIdx = 0
  let bestNearest = { x: 0, y: 0 }

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

const STEP_LABELS: { label: string; num: WizardStep }[] = [
  { label: 'المدينة', num: 1 },
  { label: 'المسار', num: 2 },
  { label: 'المحطات', num: 3 },
  { label: 'التفاصيل', num: 4 },
  { label: 'المراجعة', num: 5 },
]

// ─── Step sub-components ──────────────────────────────────────────────────────

function Step1City({ onSelect }: { onSelect: (id: string) => void }) {
  const { cityId } = useStudioStore()
  const activeCities = cities.filter(c => c.status === 'active')
  const comingSoon = cities.filter(c => c.status === 'coming_soon')

  return (
    <div className="studio-step-panel">
      <p className="studio-step-intro">
        اختر المدينة التي تعرف مساراتها. ستظهر الخطوط المنشورة على الخريطة كمرجع.
      </p>
      <div className="studio-city-grid">
        {activeCities.map(city => (
          <button
            key={city.id}
            type="button"
            className={`studio-city-card ${cityId === city.id ? 'studio-city-card--active' : ''}`}
            onClick={() => onSelect(city.id)}
          >
            <span className="studio-city-name">{city.nameAr}</span>
            <span className="studio-city-meta">{city.routeCount} مسار</span>
          </button>
        ))}
        {comingSoon.map(city => (
          <div key={city.id} className="studio-city-card studio-city-card--soon">
            <span className="studio-city-name">{city.nameAr}</span>
            <span className="studio-city-badge">قريباً</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Step2Draw({
  drawMode, activeVertexCount, conflictWarning, conflictDismissed,
  onStartDraw, onUndo, onRedraw, onDismissConflict, onBack, onNext,
}: {
  drawMode: DrawMode
  activeVertexCount: number
  conflictWarning: boolean
  conflictDismissed: boolean
  onStartDraw: () => void
  onUndo: () => void
  onRedraw: () => void
  onDismissConflict: () => void
  onBack: () => void
  onNext: () => void
}) {
  const { drawnLine } = useStudioStore()
  const isDrawing = drawMode === 'line'
  const isDone = !!drawnLine

  return (
    <div className="studio-step-panel">
      <p className="studio-step-intro">
        ارسم خط المسار على الخريطة. الخطوط الباهتة هي المسارات المنشورة. تأكد أن مسارك مختلف أو يكمّلها.
      </p>

      {conflictWarning && !conflictDismissed && (
        <div className="studio-warning">
          <span>⚠ يبدو أن هناك مساراً قريباً بالفعل. تأكد أن مسارك يختلف قبل المتابعة.</span>
          <button type="button" className="studio-warning-dismiss" onClick={onDismissConflict}>✕</button>
        </div>
      )}

      {!isDone ? (
        <button
          type="button"
          className={`studio-action-btn ${isDrawing ? 'studio-action-btn--active' : ''}`}
          onClick={onStartDraw}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          {isDrawing ? 'جاري الرسم…' : 'ابدأ رسم المسار'}
          {isDrawing && <span className="studio-tool-pill">نشط</span>}
        </button>
      ) : (
        <>
          <div className="studio-done-badge">
            <span>✓ المسار مرسوم ({drawnLine.length} نقطة)</span>
            <button type="button" className="studio-link-btn" onClick={onRedraw}>إعادة الرسم</button>
          </div>
          <p className="studio-hint" style={{ marginTop: '0.35rem' }}>انقر مرتين على الخريطة لإضافة نقطة • اسحب النقاط • انقر يمينًا / اضغط مطولاً لحذف نقطة</p>
        </>
      )}

      {isDrawing && (
        <div className="studio-draw-hints">
          <p className="studio-hint">انقر لإضافة نقاط • انقر مرتين لإنهاء المسار • Esc للإلغاء</p>
          {activeVertexCount > 0 && (
            <p className="studio-vertex-count">{activeVertexCount} نقطة مضافة</p>
          )}
          <button type="button" className="studio-util-btn" onClick={onUndo} disabled={activeVertexCount === 0}>
            ↩ تراجع
          </button>
        </div>
      )}

      <div className="studio-step-nav">
        <button type="button" className="studio-nav-back" onClick={onBack}>← رجوع</button>
        <button type="button" className="studio-nav-next" onClick={onNext} disabled={!isDone}>
          التالي ←
        </button>
      </div>
    </div>
  )
}

function Step3Stops({
  drawMode, onActivatePoint, onBack, onNext,
}: {
  drawMode: DrawMode
  onActivatePoint: () => void
  onBack: () => void
  onNext: () => void
}) {
  const { stops, removeStop, updateStopName } = useStudioStore()
  const isPointing = drawMode === 'point'

  return (
    <div className="studio-step-panel">
      <p className="studio-step-intro">
        ضع محطات التوقف على طول مسارك وامنح كلاً منها اسماً بالعربية. هذه الخطوة اختيارية.
      </p>

      <button
        type="button"
        className={`studio-action-btn ${isPointing ? 'studio-action-btn--active' : ''}`}
        onClick={onActivatePoint}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
        {isPointing ? 'جاري إضافة المحطات…' : 'إضافة محطات'}
        {isPointing && <span className="studio-tool-pill">نشط</span>}
      </button>

      {isPointing && (
        <p className="studio-hint">انقر على الخريطة بمحاذاة مسارك • سيظهر نموذج التسمية فور الوضع</p>
      )}

      {stops.length > 0 ? (
        <div className="studio-stops-list">
          <div className="studio-section-label" style={{ marginBottom: '0.5rem' }}>
            المحطات المضافة ({stops.length})
          </div>
          {stops.map((stop, i) => (
            <div key={stop.id} className="studio-stop-item">
              <span className="studio-stop-num">{i + 1}</span>
              <input
                type="text"
                className="studio-input studio-stop-input"
                value={stop.nameAr}
                placeholder="اسم المحطة بالعربية…"
                onChange={e => updateStopName(stop.id, e.target.value)}
              />
              <button
                type="button"
                className="studio-stop-remove"
                onClick={() => removeStop(stop.id)}
                aria-label="حذف المحطة"
              >✕</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="studio-empty-hint">لم تضف أي محطات بعد.</p>
      )}

      <div className="studio-step-nav">
        <button type="button" className="studio-nav-back" onClick={onBack}>← رجوع</button>
        <button type="button" className="studio-nav-next" onClick={onNext}>
          التالي ←
        </button>
      </div>
    </div>
  )
}

function Step4Meta({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { nameAr, nameEn, price, notes, setMeta } = useStudioStore()

  return (
    <div className="studio-step-panel">
      <p className="studio-step-intro">أضف معلومات المسار. الاسم بالعربية مطلوب.</p>

      <div className="studio-form">
        <div className="studio-field">
          <label className="studio-label" htmlFor="s-name-ar">
            اسم المسار <span className="studio-req">*</span>
          </label>
          <input
            id="s-name-ar" type="text" required
            className="studio-input"
            value={nameAr}
            onChange={e => setMeta({ nameAr: e.target.value })}
            placeholder="مثال: باب توما إلى برامكة"
          />
        </div>
        <div className="studio-field">
          <label className="studio-label" htmlFor="s-name-en">
            الاسم بالإنجليزية <span className="studio-opt">اختياري</span>
          </label>
          <input
            id="s-name-en" type="text"
            className="studio-input"
            value={nameEn}
            onChange={e => setMeta({ nameEn: e.target.value })}
            placeholder="e.g. Bab Touma to Baramkeh"
            dir="ltr"
          />
        </div>
        <div className="studio-field">
          <label className="studio-label" htmlFor="s-price">
            التعرفة (ل.س) <span className="studio-opt">اختياري</span>
          </label>
          <input
            id="s-price" type="number" min="0"
            className="studio-input"
            value={price}
            onChange={e => setMeta({ price: e.target.value })}
            placeholder="مثال: 1500"
            dir="ltr"
          />
        </div>
        <div className="studio-field">
          <label className="studio-label" htmlFor="s-notes">
            ملاحظات <span className="studio-opt">اختياري</span>
          </label>
          <textarea
            id="s-notes"
            className="studio-textarea"
            value={notes}
            onChange={e => setMeta({ notes: e.target.value })}
            placeholder="محطات بارزة، جداول التشغيل، تفاصيل إضافية…"
            rows={3}
          />
        </div>
      </div>

      <div className="studio-step-nav">
        <button type="button" className="studio-nav-back" onClick={onBack}>← رجوع</button>
        <button
          type="button"
          className="studio-nav-next"
          onClick={onNext}
          disabled={!nameAr.trim()}
        >
          التالي ←
        </button>
      </div>
    </div>
  )
}

function Step5Review({
  submitting, onSubmit, onBack,
}: {
  submitting: boolean
  onSubmit: () => void
  onBack: () => void
}) {
  const { cityId, nameAr, nameEn, price, notes, drawnLine, stops, setStep } = useStudioStore()
  const city = cities.find(c => c.id === cityId)

  const steps = [
    { num: 1 as const, label: 'المدينة' },
    { num: 2 as const, label: 'المسار' },
    { num: 3 as const, label: 'المحطات' },
    { num: 4 as const, label: 'البيانات' },
  ]

  return (
    <div className="studio-step-panel">
      <p className="studio-step-intro">راجع بيانات مساهمتك قبل الإرسال.</p>

      {/* Edit steps */}
      <div className="flex gap-1.5 mb-3">
        {steps.map(s => (
          <button
            key={s.num}
            type="button"
            className="studio-review-step-badge"
            onClick={() => setStep(s.num)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="studio-review-card">
        <div className="studio-review-row">
          <span className="studio-review-label">المدينة</span>
          <span className="studio-review-value">{city?.nameAr ?? cityId}</span>
        </div>
        <div className="studio-review-row">
          <span className="studio-review-label">اسم المسار</span>
          <span className="studio-review-value">{nameAr}</span>
        </div>
        {nameEn && (
          <div className="studio-review-row">
            <span className="studio-review-label">الاسم بالإنجليزية</span>
            <span className="studio-review-value" dir="ltr">{nameEn}</span>
          </div>
        )}
        {price && (
          <div className="studio-review-row">
            <span className="studio-review-label">التعرفة</span>
            <span className="studio-review-value">{price} ل.س</span>
          </div>
        )}
        {notes && (
          <div className="studio-review-row">
            <span className="studio-review-label">ملاحظات</span>
            <span className="studio-review-value">{notes}</span>
          </div>
        )}
        <div className="studio-review-row">
          <span className="studio-review-label">نقاط المسار</span>
          <span className="studio-review-value">{drawnLine?.length ?? 0} نقطة</span>
        </div>
        <div className="studio-review-row">
          <span className="studio-review-label">المحطات</span>
          <span className="studio-review-value">{stops.length > 0 ? `${stops.length} محطة` : 'لا يوجد'}</span>
        </div>
        {stops.length > 0 && (
          <div className="studio-review-stops">
            {stops.map((s, i) => (
              <span key={s.id} className="studio-review-stop-chip">
                {i + 1}. {s.nameAr || 'بدون اسم'}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="studio-submit-btn"
        disabled={submitting}
        onClick={onSubmit}
      >
        {submitting
          ? <><span className="studio-spinner" />جاري الإرسال…</>
          : <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
              إرسال المسار
            </>
        }
      </button>

      <div className="studio-step-nav">
        <button type="button" className="studio-nav-back" onClick={onBack}>← تعديل</button>
      </div>
    </div>
  )
}

function SuccessPanel({ draftId, isEditMode, onReset, onEdit, onExit }: { draftId: number; isEditMode: boolean; onReset: () => void; onEdit: () => void; onExit: () => void }) {
  return (
    <div className="studio-success">
      <div className="studio-success-icon">✓</div>
      <h2 className="studio-success-title">{isEditMode ? 'تم تحديث مسارك بنجاح!' : 'تم إرسال مسارك بنجاح!'}</h2>
      <p className="studio-success-sub">{isEditMode ? 'سيتمت مراجعة التعديلات خلال 48 ساعة.' : 'سيراجع الفريق مساهمتك خلال 48 ساعة.'}</p>
      <p className="studio-success-id">رقم المساهمة: #{draftId}</p>
      <div className="studio-success-actions">
        <button type="button" className="studio-submit-btn" onClick={onEdit}>
          تعديل المسار
        </button>
        <button type="button" className="studio-submit-btn studio-submit-btn--outline" onClick={onReset}>
          إرسال مسار آخر
        </button>
        <button type="button" className="studio-nav-back" style={{ justifyContent: 'center' }} onClick={onExit}>
          العودة للخريطة
        </button>
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
  const modeRef      = useRef<DrawMode>('idle')
  const activeLine   = useRef<Position[]>([])
  const isMobileRef  = useRef(false)
  const vertexMarkersRef = useRef<maplibregl.Marker[]>([])

  const {
    step, cityId, drawnLine, stops, nameAr, submittedDraftId,
    isEditMode, editingDraftId, editingRouteId,
    setStep, setCity, setDrawnLine, updateStopName, setSubmittedDraftId,
    setEditMode, loadDraft, reset,
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
  const [panelExpanded,      setPanelExpanded]      = useState(true)
  const [toasts,             setToasts]             = useState<Toast[]>([])

  const { data: refData } = useMapData(cityId || undefined)

  // ─── Toast ──────────────────────────────────────────────────────────────────
  const addToast = useCallback((msg: string, type: ToastType = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  // ─── Active-line source helpers ─────────────────────────────────────────────
  const flushActive = useCallback((coords: Position[], cursor?: Position) => {
    const src = mapRef.current?.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
    if (!src) return
    const features: any[] = []
    const all = cursor && coords.length > 0 ? [...coords, cursor] : coords
    if (all.length >= 2) features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: all } })
    coords.forEach(c => features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }))
    src.setData({ type: 'FeatureCollection', features })
  }, [])

  const clearActive = useCallback(() => {
    activeLine.current = []
    setActiveVertexCount(0)
    const src = mapRef.current?.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
    src?.setData({ type: 'FeatureCollection', features: [] })
  }, [])

  // ─── Mode switching ─────────────────────────────────────────────────────────
  const setMode = useCallback((mode: DrawMode) => {
    clearActive()
    modeRef.current = mode
    setDrawMode(mode)
    const canvas = mapRef.current?.getCanvas()
    if (canvas) canvas.style.cursor = mode !== 'idle' ? 'crosshair' : ''
  }, [clearActive])

  // ─── Restore pending session after login redirect ─────────────────────────
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
        if (s.cityId) patch.step = 5 as WizardStep
        useStudioStore.setState(patch)
        addToast('تمت استعادة مسارك بعد تسجيل الدخول', 'success')
      } catch { /* */ }
      localStorage.removeItem('transit:studio:pending')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Load draft for editing (?edit=DRAFT_ID) ──────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const editId = params.get('edit')
    if (!editId || isEditMode) return
    // Try loading as draft first
    fetch(`/api/v1/studio/routes/${editId}`, { credentials: 'include' })
      .then(r => {
        if (r.ok) return r.json().then(draft => ({ draft, isRoute: false }))
        // Not found as draft → try as published route
        return fetch(`/api/v1/studio/routes/${editId}/from-route`, { credentials: 'include' })
          .then(r2 => r2.ok ? r2.json().then(d => ({ draft: d, isRoute: true })) : null)
      })
      .then(result => {
        if (result) {
          loadDraft(result.draft)
          addToast(result.isRoute ? 'تم تحميل الخط المنشور للتعديل' : 'تم تحميل المسار للتعديل', 'success')
        }
      })
      .catch(() => addToast('تعذّر تحميل المسار للتعديل', 'error'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Zoom to fit route when editing ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !drawnLine || drawnLine.length < 2 || !isEditMode) return
    const map = mapRef.current
    const coords = drawnLine as maplibregl.LngLatLike[]
    const bounds = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]))
    map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 500 })
  }, [mapReady, drawnLine, isEditMode])

  // ─── Map init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: theme === 'jasmine' ? '/styles/styles/positron.json' : '/styles/styles/dark-matter.json',
      center: [36.2913, 33.5138],
      zoom: 5,
      attributionControl: false,
      doubleClickZoom: false,
    })

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
      const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

      // Reference layers (behind draw layers)
      map.addSource(SRC_REF_ROUTES, { type: 'geojson', data: empty })
      map.addSource(SRC_REF_STOPS,  { type: 'geojson', data: empty })

      map.addLayer({
        id: 'ref-layer-routes',
        type: 'line',
        source: SRC_REF_ROUTES,
        paint: { 'line-color': '#c8963a', 'line-width': 2, 'line-opacity': 0.25 },
      })
      map.addLayer({
        id: 'ref-layer-stops',
        type: 'circle',
        source: SRC_REF_STOPS,
        paint: { 'circle-radius': 4, 'circle-color': '#d4956a', 'circle-opacity': 0.3 },
      })

      // Draw layers (in front)
      map.addSource(SRC_LINES,  { type: 'geojson', data: empty })
      map.addSource(SRC_STOPS,  { type: 'geojson', data: empty })
      map.addSource(SRC_ACTIVE, { type: 'geojson', data: empty })

      map.addLayer({
        id: 'studio-layer-lines',
        type: 'line',
        source: SRC_LINES,
        paint: { 'line-color': '#f5a623', 'line-width': 3, 'line-opacity': 0.9 },
      })
      map.addLayer({
        id: 'studio-layer-stops',
        type: 'circle',
        source: SRC_STOPS,
        paint: { 'circle-radius': 7, 'circle-color': '#4a9eff', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
      })
      map.addLayer({
        id: 'studio-layer-active',
        type: 'line',
        source: SRC_ACTIVE,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#f5a623', 'line-width': 2.5, 'line-dasharray': [2, 2], 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'studio-layer-vertices',
        type: 'circle',
        source: SRC_ACTIVE,
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 5, 'circle-color': '#f5a623', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
      })

      mapRef.current = map
      setMapReady(true)
    })

    map.on('click', (e) => {
      const mode = modeRef.current
      const coord: [number, number] = [e.lngLat.lng, e.lngLat.lat]

      if (mode === 'line') {
        activeLine.current = [...activeLine.current, coord]
        setActiveVertexCount(activeLine.current.length)
        flushActive(activeLine.current)
      } else if (mode === 'point') {
        useStudioStore.getState().addStop(coord)
        const newStops = useStudioStore.getState().stops
        const last = newStops[newStops.length - 1]
        if (last) {
          setActiveStopId(last.id)
          const px = map.project(e.lngLat)
          setActiveStopPixel({ x: px.x, y: px.y })
        }
      }
    })

    map.on('dblclick', (e) => {
      e.preventDefault()
      const mode = modeRef.current
      const state = useStudioStore.getState()

      // Idle mode with existing line → insert/extend vertex
      if (mode === 'idle' && state.drawnLine && state.drawnLine.length >= 2) {
        const clickCoord: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        const coords = state.drawnLine
        const { insertIdx, distance } = findNearestSegment(coords, clickCoord[0], clickCoord[1], map)

        // Threshold: 40px → on/near line, insert between segments
        if (distance < 40) {
          const updated = [...coords]
          updated.splice(insertIdx, 0, clickCoord)
          state.setDrawnLine(updated as [number, number][])
        } else {
          // Far from line → extend start or end, whichever is closer
          const startPx = map.project(coords[0] as maplibregl.LngLatLike)
          const endPx = map.project(coords[coords.length - 1] as maplibregl.LngLatLike)
          const clickPx = map.project(e.lngLat)
          const distStart = Math.hypot(clickPx.x - startPx.x, clickPx.y - startPx.y)
          const distEnd = Math.hypot(clickPx.x - endPx.x, clickPx.y - endPx.y)
          const updated = distStart <= distEnd
            ? [clickCoord, ...coords]
            : [...coords, clickCoord]
          state.setDrawnLine(updated as [number, number][])
        }
        return
      }

      // Line drawing mode → finish line
      if (mode !== 'line') return
      const coords = activeLine.current
      if (coords.length >= 2) {
        const finalCoords = coords.slice(0, -1) as [number, number][]
        if (finalCoords.length >= 2) {
          state.setDrawnLine(finalCoords)
        }
      }
      activeLine.current = []
      setActiveVertexCount(0)
      flushActive([])
      modeRef.current = 'idle'
      setDrawMode('idle')
      map.getCanvas().style.cursor = ''
      if (isMobileRef.current) setPanelExpanded(true)
    })

    map.on('mousemove', (e) => {
      if (modeRef.current !== 'line' || activeLine.current.length === 0) return
      flushActive(activeLine.current, [e.lngLat.lng, e.lngLat.lat])
    })

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        activeLine.current = []
        setActiveVertexCount(0)
        const src = map.getSource(SRC_ACTIVE) as maplibregl.GeoJSONSource | undefined
        src?.setData({ type: 'FeatureCollection', features: [] })
        modeRef.current = 'idle'
        setDrawMode('idle')
        setActiveStopId(null)
        map.getCanvas().style.cursor = ''
      }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, [theme])

  // ─── Sync drawn line → map ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const src = mapRef.current?.getSource(SRC_LINES) as maplibregl.GeoJSONSource | undefined
    src?.setData({
      type: 'FeatureCollection',
      features: drawnLine
        ? [{ type: 'Feature', properties: { type: 'route' }, geometry: { type: 'LineString', coordinates: drawnLine } }]
        : [],
    })
  }, [mapReady, drawnLine])

  // ─── Draggable vertex markers for route editing ─────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    // Clear existing markers
    vertexMarkersRef.current.forEach(m => m.remove())
    vertexMarkersRef.current = []

    // Remove any lingering tooltip
    const existingTooltip = mapContainer.current?.querySelector('.studio-vertex-remove-tooltip')
    if (existingTooltip) existingTooltip.remove()

    // Only show when line exists and we're not actively drawing
    if (!drawnLine || drawnLine.length < 2 || drawMode !== 'idle') return

    let activeTooltip: { el: HTMLDivElement; marker: maplibregl.Marker } | null = null

    const dismissTooltip = () => {
      if (activeTooltip) {
        activeTooltip.el.remove()
        activeTooltip = null
      }
    }

    const showRemoveTooltip = (marker: maplibregl.Marker, idx: number) => {
      dismissTooltip()

      const tooltipEl = document.createElement('div')
      tooltipEl.className = 'studio-vertex-remove-tooltip'
      tooltipEl.style.cssText = `
        position:absolute; z-index:20;
        display:inline-flex; align-items:center; gap:4px;
        background:var(--surface,#1e1e1e); border:1px solid var(--border,#333);
        border-radius:8px; padding:3px 6px;
        box-shadow:0 2px 12px rgba(0,0,0,0.4);
        pointer-events:all; cursor:default;
        animation:tooltip-pop 0.15s ease both;
        direction:rtl;
      `
      tooltipEl.innerHTML = `
        <button data-action="cancel" style="
          background:transparent;color:var(--muted,#888);border:none;border-radius:4px;
          padding:1px 4px;font-size:12px;font-family:inherit;
          cursor:pointer;line-height:1;
        ">✕</button>
        <button data-action="remove" style="
          background:#ef4444;color:#fff;border:none;border-radius:5px;
          padding:2px 8px;font-size:11px;font-weight:700;font-family:inherit;
          cursor:pointer;
        ">حذف</button>
      `

      // Position above the marker
      const containerRect = mapContainer.current!.getBoundingClientRect()
      const markerPos = marker.getElement().getBoundingClientRect()
      const tooltipWidth = 110
      let left = markerPos.left - containerRect.left + markerPos.width / 2 - tooltipWidth / 2
      left = Math.max(4, Math.min(left, containerRect.width - tooltipWidth - 4))
      tooltipEl.style.left = `${left}px`
      tooltipEl.style.top = `${markerPos.top - containerRect.top - 32}px`
      tooltipEl.style.width = `${tooltipWidth}px`

      tooltipEl.querySelector('[data-action="remove"]')!.addEventListener('click', (e) => {
        e.stopPropagation()
        const current = useStudioStore.getState().drawnLine
        if (!current || current.length <= 2) {
          dismissTooltip()
          return
        }
        const updated = [...current]
        updated.splice(idx, 1)
        useStudioStore.getState().setDrawnLine(updated as [number, number][])
        dismissTooltip()
      })

      tooltipEl.querySelector('[data-action="cancel"]')!.addEventListener('click', (e) => {
        e.stopPropagation()
        dismissTooltip()
      })

      mapContainer.current!.appendChild(tooltipEl)
      activeTooltip = { el: tooltipEl, marker }
    }

    drawnLine.forEach((coord, idx) => {
      const el = document.createElement('div')
      el.className = 'studio-vertex-handle'
      el.style.cssText = 'width:16px;height:16px;border-radius:50%;background:#f5a623;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4);cursor:grab;touch-action:none;'

      const marker = new maplibregl.Marker({ element: el, draggable: true, offset: [0, 0] })
        .setLngLat(coord as maplibregl.LngLatLike)
        .addTo(map)

      // Drag handling
      marker.on('dragend', () => {
        const pos = marker.getLngLat()
        const newCoord: [number, number] = [pos.lng, pos.lat]
        const current = useStudioStore.getState().drawnLine
        if (!current) return
        const updated = [...current]
        updated[idx] = newCoord
        useStudioStore.getState().setDrawnLine(updated as [number, number][])
      })

      // Right-click → show remove tooltip (desktop)
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        showRemoveTooltip(marker, idx)
      })

      // Long-press → show remove tooltip (mobile)
      let longPressTimer: ReturnType<typeof setTimeout> | null = null
      let touchStartPos = { x: 0, y: 0 }

      el.addEventListener('touchstart', (e) => {
        touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        longPressTimer = setTimeout(() => {
          showRemoveTooltip(marker, idx)
        }, 500)
      }, { passive: true })

      el.addEventListener('touchmove', (e) => {
        if (longPressTimer) {
          const dx = e.touches[0].clientX - touchStartPos.x
          const dy = e.touches[0].clientY - touchStartPos.y
          if (Math.hypot(dx, dy) > 10) {
            clearTimeout(longPressTimer)
            longPressTimer = null
          }
        }
      }, { passive: true })

      el.addEventListener('touchend', () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer)
          longPressTimer = null
        }
      })

      vertexMarkersRef.current.push(marker)
    })

    // Dismiss tooltip when clicking on the map (not on a vertex)
    const onMapMouseDown = () => { dismissTooltip() }
    map.on('mousedown', onMapMouseDown)

    return () => {
      map.off('mousedown', onMapMouseDown)
      dismissTooltip()
      vertexMarkersRef.current.forEach(m => m.remove())
      vertexMarkersRef.current = []
    }
  }, [mapReady, drawnLine, drawMode])

  // ─── Sync stops → map ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const src = mapRef.current?.getSource(SRC_STOPS) as maplibregl.GeoJSONSource | undefined
    src?.setData({
      type: 'FeatureCollection',
      features: stops.map(s => ({
        type: 'Feature',
        properties: { type: 'stop', id: s.id, nameAr: s.nameAr },
        geometry: { type: 'Point', coordinates: s.coordinates },
      })),
    })
  }, [mapReady, stops])

  // ─── Sync reference layer → map ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return
    const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }
    ;(mapRef.current?.getSource(SRC_REF_ROUTES) as maplibregl.GeoJSONSource | undefined)
      ?.setData((refData?.routes ?? empty) as any)
    ;(mapRef.current?.getSource(SRC_REF_STOPS) as maplibregl.GeoJSONSource | undefined)
      ?.setData((refData?.stops ?? empty) as any)
  }, [mapReady, refData])

  // ─── Conflict check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!drawnLine || !refData) { setConflictWarning(false); return }
    setConflictWarning(checkConflict(drawnLine, refData.routes.features))
    setConflictDismissed(false)
  }, [drawnLine, refData])

  // ─── Stop popup position tracking ────────────────────────────────────────────
  useEffect(() => {
    if (!activeStopId || !mapReady || !mapRef.current) { setActiveStopPixel(null); return }
    const stop = stops.find(s => s.id === activeStopId)
    if (!stop) { setActiveStopPixel(null); return }

    const update = () => {
      const px = mapRef.current!.project(stop.coordinates as maplibregl.LngLatLike)
      setActiveStopPixel({ x: px.x, y: px.y })
    }
    update()
    mapRef.current.on('move', update)
    return () => { mapRef.current?.off('move', update) }
  }, [activeStopId, stops, mapReady])

  // ─── Mobile detection ───────────────────────────────────────────────────────
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    isMobileRef.current = mq.matches
    const handler = (e: MediaQueryListEvent) => { isMobileRef.current = e.matches }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Auto-expand panel when entering steps that don't involve drawing
  useEffect(() => {
    if (isMobileRef.current && (step === 1 || step === 4 || step === 5)) {
      setPanelExpanded(true)
    }
  }, [step])

  // ─── Handlers ────────────────────────────────────────────────────────────────
  const handleCitySelect = useCallback((id: string) => {
    if (id !== cityId) {
      useStudioStore.getState().setDrawnLine(null)
      useStudioStore.getState().reset()
    }
    setCity(id)
    setStep(2)
    const city = cities.find(c => c.id === id)
    if (city?.bounds && mapRef.current && mapReady) {
      mapRef.current.fitBounds(city.bounds as [[number, number], [number, number]], { padding: 60 })
    }
  }, [cityId, setCity, setStep, mapReady])

  const handleFinishLine = useCallback(() => {
    const coords = activeLine.current
    if (coords.length >= 2) {
      useStudioStore.getState().setDrawnLine(coords as [number, number][])
    }
    activeLine.current = []
    setActiveVertexCount(0)
    flushActive([])
    setMode('idle')
    if (isMobileRef.current) setPanelExpanded(true)
  }, [flushActive, setMode])

  const handleStartDraw = useCallback(() => {
    if (drawMode === 'line') {
      setMode('idle')
    } else {
      setMode('line')
      if (isMobileRef.current) setPanelExpanded(false)
    }
  }, [drawMode, setMode])

  const handleRedraw = useCallback(() => {
    setDrawnLine(null)
    clearActive()
    setMode('line')
  }, [setDrawnLine, clearActive, setMode])

  const handleUndo = useCallback(() => {
    if (activeLine.current.length > 0) {
      activeLine.current = activeLine.current.slice(0, -1)
      setActiveVertexCount(activeLine.current.length)
      flushActive(activeLine.current)
    }
  }, [flushActive])

  const handleActivatePoint = useCallback(() => {
    if (drawMode === 'point') { setMode('idle') } else {
      setMode('point')
      if (isMobileRef.current) setPanelExpanded(false)
    }
  }, [drawMode, setMode])

  const handleStopConfirm = useCallback((name: string) => {
    if (activeStopId !== null) {
      updateStopName(activeStopId, name)
    }
    setActiveStopId(null)
    setActiveStopPixel(null)
  }, [activeStopId, updateStopName])

  const handleStopDismiss = useCallback(() => {
    setActiveStopId(null)
    setActiveStopPixel(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!drawnLine) { addToast('الرجاء رسم المسار أولاً', 'error'); return }
    if (!nameAr.trim()) { addToast('اسم المسار بالعربية مطلوب', 'error'); return }

    // Require auth: guests must login before submitting so the route is assigned to their account
    if (!user) {
      const storeState = useStudioStore.getState()
      try {
        localStorage.setItem('transit:studio:pending', JSON.stringify({
          cityId: storeState.cityId,
          drawnLine: storeState.drawnLine,
          stops: storeState.stops,
          nameAr: storeState.nameAr,
          nameEn: storeState.nameEn,
          price: storeState.price,
          notes: storeState.notes,
          editingRouteId: storeState.editingRouteId,
        }))
      } catch { /* ignore */ }
      window.location.href = '/auth/google?redirect=/transit/studio'
      return
    }

    const storeState = useStudioStore.getState()
    const geojson: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'route' },
          geometry: { type: 'LineString', coordinates: drawnLine },
        },
        ...storeState.stops.map(s => ({
          type: 'Feature' as const,
          properties: { type: 'stop', nameAr: s.nameAr },
          geometry: { type: 'Point' as const, coordinates: s.coordinates },
        })),
      ],
    }

    setSubmitting(true)
    try {
      const baseUrl = '/api'
      const payload: Record<string, any> = {
        city_id:  storeState.cityId,
        name_ar:  storeState.nameAr.trim(),
        name_en:  storeState.nameEn.trim() || null,
        price:    parseInt(storeState.price) || null,
        notes:    storeState.notes.trim() || null,
        geojson,
      }

      let res: Response

      if (isEditMode && editingDraftId) {
        // Updating an existing draft
        res = await fetch(`${baseUrl}/v1/studio/routes/${editingDraftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
      } else if (isEditMode && editingRouteId) {
        // Creating a new draft linked to a published route
        payload.route_id = editingRouteId
        res = await fetch(`${baseUrl}/v1/studio/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        // Creating a brand new draft
        res = await fetch(`${baseUrl}/v1/studio/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        setSubmittedDraftId(data?.id ?? 0)
        if (isEditMode) addToast('تم تحديث المسار', 'success')
      } else {
        const err = await res.json().catch(() => ({}))
        addToast('حدث خطأ: ' + (err.message || `HTTP ${res.status}`), 'error')
      }
    } catch {
      addToast('تعذّر الاتصال بالخادم', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [drawnLine, nameAr, addToast, setSubmittedDraftId, user, isEditMode, editingDraftId, editingRouteId])

  const handleReset = useCallback(() => {
    reset()
    setEditMode(null)
    clearActive()
    setMode('idle')
    setConflictWarning(false)
    setConflictDismissed(false)
  }, [reset, setEditMode, clearActive, setMode])

  // Step progress can go back to completed steps
  const canGoToStep = (num: WizardStep) => num < step

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="studio-shell" dir="rtl">

      {/* Header */}
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
              <h1 className="studio-title">استوديو ترانزيت</h1>
            </div>
          </div>
          <div className="studio-header-status">
            <span className={`studio-dot ${mapReady ? 'studio-dot--ready' : 'studio-dot--loading'}`} />
            <span className="studio-status-text">{mapReady ? 'الخريطة جاهزة' : 'تحميل الخريطة…'}</span>
            {user && (
              <Link href="/dashboard" className="studio-my-contrib-btn" title="مساهماتي">
                مساهماتي
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Step strip */}
      <div className="studio-steps" role="navigation" aria-label="خطوات المساهمة">
        {STEP_LABELS.map(({ label, num }) => {
          const state = num < step ? 'done' : num === step ? 'active' : 'future'
          return (
            <button
              key={num}
              type="button"
              className={`studio-step studio-step--${state}`}
              onClick={() => canGoToStep(num) ? setStep(num) : undefined}
              disabled={state === 'future'}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              {state === 'done' && <span className="studio-step-check">✓</span>}
              {label}
            </button>
          )
        })}
      </div>

      {/* Body */}
      <div className="studio-body">
        <aside className={`studio-sidebar${!panelExpanded ? ' studio-sidebar--collapsed' : ''}`}>
          <button
            type="button"
            className="studio-panel-handle"
            onClick={() => setPanelExpanded(v => !v)}
            aria-label={panelExpanded ? 'طي اللوحة' : 'عرض اللوحة'}
          >
            <span className="studio-panel-pill" />
            <span className="studio-panel-label">
              {STEP_LABELS.find(s => s.num === step)?.label ?? ''}
            </span>
            <svg
              className="studio-panel-chevron"
              width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </button>
          <div className="studio-sidebar-inner">
            {step === 1 && (
              <Step1City onSelect={handleCitySelect} />
            )}
            {step === 2 && (
              <Step2Draw
                drawMode={drawMode}
                activeVertexCount={activeVertexCount}
                conflictWarning={conflictWarning}
                conflictDismissed={conflictDismissed}
                onStartDraw={handleStartDraw}
                onUndo={handleUndo}
                onRedraw={handleRedraw}
                onDismissConflict={() => setConflictDismissed(true)}
                onBack={() => { setMode('idle'); setStep(1) }}
                onNext={() => { setMode('idle'); setStep(3) }}
              />
            )}
            {step === 3 && (
              <Step3Stops
                drawMode={drawMode}
                onActivatePoint={handleActivatePoint}
                onBack={() => { setMode('idle'); setStep(2) }}
                onNext={() => { setMode('idle'); setStep(4) }}
              />
            )}
            {step === 4 && (
              <Step4Meta
                onBack={() => setStep(3)}
                onNext={() => setStep(5)}
              />
            )}
            {step === 5 && (
              submittedDraftId !== null ? (
                <SuccessPanel
                  draftId={submittedDraftId}
                  isEditMode={isEditMode}
                  onReset={handleReset}
                  onEdit={() => { setSubmittedDraftId(null); setStep(5) }}
                  onExit={() => router.push('/transit')}
                />
              ) : (
                <Step5Review
                  submitting={submitting}
                  onSubmit={handleSubmit}
                  onBack={() => setStep(4)}
                />
              )
            )}
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
              {drawMode === 'line'  && '✏ رسم مسار'}
              {drawMode === 'point' && '📍 إضافة محطة: انقر لوضع محطة'}
            </div>
          )}

          {drawMode === 'line' && activeVertexCount >= 2 && (
            <button
              type="button"
              className="studio-finish-btn"
              onClick={handleFinishLine}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              إنهاء المسار
            </button>
          )}

          {activeStopId !== null && activeStopPixel && (() => {
            const stop = stops.find(s => s.id === activeStopId)
            return stop ? (
              <StopNamePopup
                stop={stop}
                pixel={activeStopPixel}
                onConfirm={handleStopConfirm}
                onDismiss={handleStopDismiss}
              />
            ) : null
          })()}
        </div>
      </div>

      {/* Toasts */}
      <div className="studio-toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`studio-toast studio-toast--${t.type}`}>
            <span>{t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}</span>
            <span>{t.msg}</span>
          </div>
        ))}
      </div>

      <style>{`
        .studio-shell {
          display: flex; flex-direction: column;
          height: 100%; overflow: hidden;
          background: var(--bg); color: var(--text);
          font-family: var(--font-ar, 'IBM Plex Sans Arabic', sans-serif);
        }

        /* Header */
        .studio-header { flex-shrink: 0; border-bottom: 1px solid var(--border); background: var(--surface); }
        .studio-header-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 1.25rem; height: 52px;
        }
        .studio-header-brand { display: flex; align-items: center; gap: 0.75rem; }
        .studio-back-btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 32px; height: 32px; border-radius: 8px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--gold); transition: background 0.15s; text-decoration: none;
        }
        .studio-back-btn:hover { background: var(--border); }
        .studio-title-group { display: flex; align-items: center; gap: 0.35rem; }
        .studio-brand-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; color: var(--gold); text-transform: uppercase; }
        .studio-brand-sep   { color: var(--muted); font-size: 0.875rem; }
        .studio-title       { font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0; }
        .studio-header-status { display: flex; align-items: center; gap: 0.45rem; }
        .studio-my-contrib-btn {
          margin-inline-start: 0.5rem;
          padding: 0.3rem 0.7rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--gold);
          background: color-mix(in srgb, var(--gold) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--gold) 35%, transparent);
          transition: background 0.15s ease, color 0.15s ease;
        }
        .studio-my-contrib-btn:hover {
          background: color-mix(in srgb, var(--gold) 22%, transparent);
          color: var(--gold);
        }
        .studio-dot { width: 8px; height: 8px; border-radius: 50%; }
        .studio-dot--ready   { background: #22c55e; box-shadow: 0 0 6px #22c55e88; }
        .studio-dot--loading { background: var(--muted); animation: pulse 1.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .studio-status-text { font-size: 0.73rem; color: var(--muted); }

        /* Step strip */
        .studio-steps {
          display: flex; align-items: stretch; flex-shrink: 0;
          border-bottom: 1px solid var(--border); background: var(--surface);
          overflow-x: auto; scrollbar-width: none;
        }
        .studio-steps::-webkit-scrollbar { display: none; }
        .studio-step {
          flex: 1; min-width: max-content; padding: 0.55rem 1rem;
          display: flex; align-items: center; justify-content: center; gap: 0.3rem;
          font-size: 0.78rem; font-weight: 500; font-family: inherit;
          background: transparent; border: none; border-bottom: 2px solid transparent;
          color: var(--muted); cursor: default; transition: all 0.15s;
          white-space: nowrap;
        }
        .studio-step--active { color: var(--gold); border-bottom-color: var(--gold); font-weight: 700; }
        .studio-step--done   { color: var(--text); cursor: pointer; }
        .studio-step--done:hover { background: var(--surface-2); }
        .studio-step--future { opacity: 0.45; pointer-events: none; }
        .studio-step-check   { color: #22c55e; font-size: 0.7rem; }

        /* Body */
        .studio-body { display: flex; flex: 1; overflow: hidden; }

        /* Sidebar */
        .studio-sidebar {
          width: 340px; flex-shrink: 0;
          border-left: 1px solid var(--border);
          background: var(--surface); overflow-y: auto;
          scrollbar-width: thin; scrollbar-color: var(--border) transparent;
        }
        .studio-sidebar-inner { padding: 1.125rem; display: flex; flex-direction: column; }

        /* Step panels */
        .studio-step-panel { display: flex; flex-direction: column; gap: 1rem; }
        .studio-step-intro { font-size: 0.8rem; color: var(--muted); line-height: 1.6; margin: 0; }

        /* City grid */
        .studio-city-grid { display: flex; flex-direction: column; gap: 0.5rem; }
        .studio-city-card {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.75rem 1rem; border-radius: 10px;
          border: 1px solid var(--border); background: var(--surface-2);
          cursor: pointer; transition: all 0.15s; font-family: inherit;
          text-align: right;
        }
        .studio-city-card:hover { border-color: var(--gold); background: var(--bg); }
        .studio-city-card--active { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 10%, var(--bg)); }
        .studio-city-card--soon { cursor: not-allowed; opacity: 0.5; }
        .studio-city-name { font-size: 0.95rem; font-weight: 600; color: var(--text); }
        .studio-city-meta { font-size: 0.75rem; color: var(--muted); }
        .studio-city-badge {
          font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.5rem;
          border-radius: 20px; background: var(--border); color: var(--muted);
        }

        /* Warning */
        .studio-warning {
          display: flex; align-items: flex-start; gap: 0.5rem;
          padding: 0.625rem 0.75rem; border-radius: 8px;
          background: color-mix(in srgb, #f59e0b 12%, transparent);
          border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
          font-size: 0.78rem; color: var(--text); line-height: 1.5;
        }
        .studio-warning > span { flex: 1; }
        .studio-warning-dismiss {
          background: none; border: none; cursor: pointer;
          color: var(--muted); font-size: 0.8rem; padding: 0 0.2rem;
          line-height: 1; flex-shrink: 0;
        }
        .studio-warning-dismiss:hover { color: var(--text); }

        /* Action buttons */
        .studio-action-btn {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 1rem; border-radius: 9px;
          border: 1px solid var(--border); background: var(--surface-2);
          color: var(--text); font-family: inherit; font-size: 0.875rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .studio-action-btn:hover { border-color: var(--gold); }
        .studio-action-btn--active { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 12%, var(--bg)); color: var(--gold); }
        .studio-tool-pill {
          margin-right: auto; font-size: 0.65rem; font-weight: 700;
          padding: 0.1rem 0.45rem; border-radius: 20px;
          background: currentColor; color: var(--bg);
        }

        /* Done badge */
        .studio-done-badge {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0.625rem 0.875rem; border-radius: 9px;
          background: color-mix(in srgb, #22c55e 10%, transparent);
          border: 1px solid color-mix(in srgb, #22c55e 25%, transparent);
          font-size: 0.82rem; color: var(--text);
        }
        .studio-link-btn {
          background: none; border: none; cursor: pointer; font-family: inherit;
          font-size: 0.78rem; color: var(--gold); text-decoration: underline; padding: 0;
        }

        /* Draw hints */
        .studio-draw-hints { display: flex; flex-direction: column; gap: 0.4rem; }
        .studio-hint { font-size: 0.775rem; color: var(--muted); margin: 0; line-height: 1.55; }
        .studio-vertex-count { font-size: 0.75rem; color: var(--gold); font-weight: 600; margin: 0; }

        /* Stops list */
        .studio-stops-list { display: flex; flex-direction: column; gap: 0.5rem; }
        .studio-stop-item { display: flex; align-items: center; gap: 0.4rem; }
        .studio-stop-num {
          width: 1.5rem; height: 1.5rem; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 700; background: var(--surface-2); color: var(--muted);
        }
        .studio-stop-input { flex: 1; }
        .studio-stop-remove {
          width: 1.6rem; height: 1.6rem; border-radius: 6px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: none; border: 1px solid var(--border); cursor: pointer;
          font-size: 0.7rem; color: var(--muted); transition: all 0.12s;
        }
        .studio-stop-remove:hover { border-color: #ef4444; color: #ef4444; }
        .studio-empty-hint { font-size: 0.78rem; color: var(--muted); margin: 0; }

        /* Step nav */
        .studio-step-nav { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
        .studio-nav-back {
          flex: 1; padding: 0.5rem; border-radius: 8px;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted); font-family: inherit; font-size: 0.82rem; font-weight: 500;
          cursor: pointer; transition: all 0.12s;
        }
        .studio-nav-back:hover { background: var(--surface-2); color: var(--text); }
        .studio-nav-next {
          flex: 2; padding: 0.5rem; border-radius: 8px;
          border: none; background: var(--gold);
          color: var(--bg); font-family: inherit; font-size: 0.82rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.12s;
        }
        .studio-nav-next:hover:not(:disabled) { opacity: 0.87; }
        .studio-nav-next:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Form */
        .studio-form { display: flex; flex-direction: column; gap: 0.75rem; }
        .studio-field { display: flex; flex-direction: column; gap: 0.3rem; }
        .studio-label { font-size: 0.8rem; font-weight: 500; color: var(--text); display: flex; align-items: center; gap: 0.3rem; }
        .studio-req { color: #ef4444; }
        .studio-opt { font-size: 0.7rem; color: var(--muted); font-weight: 400; }

        .studio-input, .studio-textarea {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          border-radius: 8px; color: var(--text); font-family: inherit;
          font-size: 0.85rem; padding: 0.5rem 0.7rem;
          transition: border-color 0.15s, box-shadow 0.15s; outline: none;
        }
        .studio-input::placeholder, .studio-textarea::placeholder { color: var(--muted); opacity: 0.65; }
        .studio-input:focus, .studio-textarea:focus {
          border-color: var(--gold);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--gold) 15%, transparent);
        }
        .studio-textarea { resize: vertical; }

        /* Review card */
        .studio-review-card {
          border: 1px solid var(--border); border-radius: 10px;
          background: var(--surface-2); padding: 0.875rem;
          display: flex; flex-direction: column; gap: 0.55rem;
        }
        .studio-review-row { display: flex; align-items: flex-start; gap: 0.5rem; }
        .studio-review-label { font-size: 0.73rem; color: var(--muted); font-weight: 500; min-width: 90px; padding-top: 0.05rem; }
        .studio-review-value { font-size: 0.83rem; color: var(--text); flex: 1; }
        .studio-review-stops {
          display: flex; flex-wrap: wrap; gap: 0.35rem;
          padding-top: 0.25rem; border-top: 1px solid var(--border);
        }
        .studio-review-stop-chip {
          font-size: 0.72rem; padding: 0.15rem 0.5rem; border-radius: 20px;
          background: var(--bg); border: 1px solid var(--border); color: var(--muted);
        }

        .studio-review-step-badge {
          flex: 1; padding: 0.35rem 0.5rem; border-radius: 7px;
          border: 1px solid var(--border); background: var(--surface);
          color: var(--muted); font-family: inherit; font-size: 0.72rem; font-weight: 600;
          cursor: pointer; transition: all 0.15s; text-align: center;
        }
        .studio-review-step-badge:hover { background: var(--gold); color: var(--bg); border-color: var(--gold); }

        /* Submit */
        .studio-submit-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.45rem;
          width: 100%; padding: 0.7rem; border-radius: 9px;
          border: none; background: var(--gold); color: var(--bg);
          font-family: inherit; font-size: 0.9rem; font-weight: 700;
          cursor: pointer; transition: opacity 0.15s;
        }
        .studio-submit-btn:not(:disabled):hover { opacity: 0.87; }
        .studio-submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .studio-submit-btn--outline {
          background: transparent; color: var(--gold); border: 1.5px solid var(--gold);
        }
        .studio-submit-btn--outline:hover { background: var(--gold); color: var(--bg); }
        .studio-spinner {
          width: 15px; height: 15px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }

        /* Success panel */
        .studio-success {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.75rem; padding: 2rem 1rem; text-align: center;
        }
        .studio-success-icon {
          width: 52px; height: 52px; border-radius: 50%;
          background: #22c55e; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; font-weight: 700;
        }
        .studio-success-title { font-size: 1.05rem; font-weight: 700; color: var(--text); margin: 0; }
        .studio-success-sub   { font-size: 0.82rem; color: var(--muted); margin: 0; }
        .studio-success-id    { font-size: 0.78rem; color: var(--muted); margin: 0; font-variant-numeric: tabular-nums; }
        .studio-success-actions { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; margin-top: 0.5rem; }

        /* Section label */
        .studio-section-label {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.06em; color: var(--muted);
        }

        /* Util button */
        .studio-util-btn {
          width: 100%; padding: 0.45rem 0.5rem; border-radius: 7px;
          border: 1px solid var(--border); background: transparent;
          color: var(--muted); font-family: inherit; font-size: 0.78rem; font-weight: 500;
          cursor: pointer; transition: all 0.15s;
        }
        .studio-util-btn:not(:disabled):hover { background: var(--surface); color: var(--text); }
        .studio-util-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        /* Stop name popup */
        .studio-stop-popup {
          position: absolute; z-index: 20;
          display: flex; gap: 0.35rem;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 0.35rem 0.4rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
          pointer-events: all;
        }
        .studio-stop-popup-input {
          width: 140px; font-size: 0.82rem; padding: 0.35rem 0.5rem;
        }
        .studio-stop-popup-btn {
          padding: 0.35rem 0.65rem; border-radius: 6px;
          border: none; background: var(--gold); color: var(--bg);
          font-family: inherit; font-size: 0.78rem; font-weight: 700;
          cursor: pointer; white-space: nowrap;
        }

        /* Finish-line floating button */
        .studio-finish-btn {
          position: absolute; bottom: 5rem; left: 50%; transform: translateX(-50%); z-index: 10;
          display: flex; align-items: center; gap: 0.45rem;
          padding: 0.7rem 1.6rem; border-radius: 24px;
          border: none; background: #16a34a; color: #fff;
          font-family: inherit; font-size: 0.875rem; font-weight: 700;
          cursor: pointer; white-space: nowrap;
          box-shadow: 0 4px 20px rgba(22,163,74,0.45);
          animation: badge-in 0.2s ease both;
          touch-action: manipulation; -webkit-tap-highlight-color: transparent;
        }
        .studio-finish-btn:active { opacity: 0.82; }

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
        @keyframes tooltip-pop { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .studio-mode-badge--line  { background: rgba(56,142,60,0.92); color:#fff; }
        .studio-mode-badge--point { background: rgba(25,118,210,0.92); color:#fff; }

        @keyframes spin { to { transform: rotate(360deg); } }

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

        /* Panel handle is hidden on desktop and shown on mobile. */
        .studio-panel-handle { display: none; }
        .studio-panel-pill   { display: none; }
        .studio-panel-label  { flex: 1; text-align: right; }
        .studio-panel-chevron { flex-shrink: 0; }

        /* MapLibre controls */
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

        /* ── Mobile bottom-sheet layout ───────────────────────────────────── */
        @media (max-width: 767px) {
          /* Body becomes a positioning context so sheet overlays the map */
          .studio-body { position: relative; }

          /* Sidebar becomes a bottom sheet sliding over the map */
          .studio-sidebar {
            position: absolute; bottom: 0; left: 0; right: 0; z-index: 50;
            width: auto; max-height: 72vh; overflow-y: auto;
            border-left: none; border-top: 1px solid var(--border);
            border-radius: 16px 16px 0 0;
            transform: translateY(0);
            transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
            background: var(--surface);
          }
          .studio-sidebar--collapsed { transform: translateY(calc(100% - 56px)); }

          /* Panel handle */
          .studio-panel-handle {
            display: flex; align-items: center; justify-content: space-between;
            position: relative;
            width: 100%; padding: 1.5rem 1rem 0.65rem;
            border: none; background: transparent; cursor: pointer;
            font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--text);
            border-bottom: 1px solid var(--border);
            touch-action: manipulation; -webkit-tap-highlight-color: transparent;
          }
          .studio-panel-pill {
            display: block;
            position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
            width: 36px; height: 4px; border-radius: 2px; background: var(--border);
          }
          .studio-panel-chevron { transition: transform 0.25s; }
          .studio-sidebar:not(.studio-sidebar--collapsed) .studio-panel-chevron {
            transform: rotate(180deg);
          }

          /* Sidebar inner padding */
          .studio-sidebar-inner { padding: 0.875rem; }

          /* Toasts sit above the collapsed sheet handle */
          .studio-toasts { bottom: 4.5rem; }

          /* Mode badge nudge for smaller screens */
          .studio-mode-badge { top: 0.65rem; right: 0.65rem; font-size: 0.75rem; }
        }
      `}</style>
    </div>
  )
}

export default function TransitStudioPage() {
  return (
    <TransitLayout>
      <Head>
        <title>استوديو ترانزيت | إضافة خط مواصلات</title>
        <meta name="description" content="استوديو ترانزيت سوريا - أداة تفاعلية للمساهمة وإضافة خطوط سرافيس ومواقف مواصلات جديدة لخرائط النقل العام." />
      </Head>
      <TransitStudioPageContent />
    </TransitLayout>
  )
}
