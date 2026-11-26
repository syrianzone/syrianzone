import { useState, useEffect, useContext, useId, useRef } from 'react'
import { LocateFixed } from 'lucide-react'
import { useMap } from '@/Components/map/MapContext'
import { Button } from '@/Components/ui/button'
import { LocationContext, LocationStatusContext, useRequestUserLocation } from './MapCanvas'
import { useMapStore } from '../../_store/useMapStore'
import { NEARBY_STOPS_RADIUS_M } from '@/Domain/transit/limits';
import { transitApi, type NearbyStop } from '../../_lib/api'

export default function NearbyTransitDrawer() {
  const [stops, setStops] = useState<NearbyStop[]>([])
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const map = useMap()
  const userLocation = useContext(LocationContext)
  const locationStatus = useContext(LocationStatusContext)
  const requestLocation = useRequestUserLocation()
  const { setSelectedRouteId } = useMapStore()
  const drawerId = useId()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (!userLocation || !isOpen) return

    // A live GPS watch moves the point while the drawer is open: each new fix
    // aborts the previous request so an older answer never overwrites a newer one.
    const ctrl = new AbortController()
    const fetchNearby = async () => {
      setLoading(true)
      setFetchError(false)
      try {
        const rows = await transitApi.nearbyStops(userLocation.lat, userLocation.lng, NEARBY_STOPS_RADIUS_M, ctrl.signal)
        if (!ctrl.signal.aborted) setStops(rows)
      } catch {
        if (!ctrl.signal.aborted) setFetchError(true)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }

    fetchNearby()
    return () => ctrl.abort()
  }, [userLocation, isOpen])

  // Opening moves focus into the drawer; closing returns it to the toggle, but
  // only when focus was inside the drawer (a route pick moves on to the sidebar).
  useEffect(() => {
    if (isOpen) {
      closeRef.current?.focus({ preventScroll: true })
    } else if (wasOpenRef.current) {
      const active = document.activeElement
      if (!active || active === document.body) toggleRef.current?.focus({ preventScroll: true })
    }
    wasOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isOpen])

  // Clear results when drawer closes so stale data doesn't flash on reopen
  useEffect(() => {
    if (!isOpen) setStops([])
  }, [isOpen])

  const panToLocation = () => {
    if (map && userLocation) {
      map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 16 })
    }
  }

  const drawerContent = () => {
    if (locationStatus === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-[var(--muted)]">
          <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">جاري تحديد موقعك...</span>
        </div>
      )
    }

    if (locationStatus === 'denied') {
      return (
        <div className="py-8 text-center">
          <p className="text-sm text-[var(--muted)]">يرجى السماح بالوصول إلى موقعك من إعدادات المتصفح</p>
        </div>
      )
    }

    if (locationStatus === 'idle') {
      return (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-[var(--muted)]">
            لم نحدد موقعك بعد، اضغط «أظهر موقعي» لعرض المواقف القريبة منك
          </p>
          <Button type="button" size="sm" onClick={requestLocation}>
            <LocateFixed aria-hidden="true" />
            أظهر موقعي
          </Button>
        </div>
      )
    }

    if (loading) {
      return (
        <div className="flex justify-center py-8">
          <svg className="h-6 w-6 animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )
    }

    if (fetchError) {
      return (
        <div className="py-8 text-center text-sm text-[var(--pomegranate)]">
          تعذر تحميل المواقف القريبة، حاول مجدداً
        </div>
      )
    }

    if (stops.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-[var(--muted)]">
          لا توجد مواقف في نطاق {NEARBY_STOPS_RADIUS_M} متر
        </div>
      )
    }

    return (
      <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(50dvh - 80px)' }}>
        {stops.map((stop) => (
          <div key={stop.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <h3 className="font-semibold text-[var(--text)]">{stop.nameAr}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {stop.routes.map((route) => (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => {
                    setSelectedRouteId(route.id)
                    setIsOpen(false)
                  }}
                  className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  {route.name_ar}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <>
      {/* Floating action buttons — the bottom-left corner, the one the map's
          own zoom/attribution controls leave free (the city map puts them at
          bottom-right; see Components/map/createMap). */}
      <div className="absolute bottom-[calc(var(--sz-sheet-h,250px)+20px)] end-4 z-20 flex flex-col gap-2 sm:bottom-6">
        <button
          type="button"
          // One control for both steps: it asks for the location first (only on
          // this press, never on load) and pans to it once a fix is available.
          onClick={locationStatus === 'available' ? panToLocation : requestLocation}
          disabled={locationStatus === 'loading'}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface)] text-[var(--text)] shadow-lg transition-transform hover:scale-105 disabled:opacity-40"
          aria-label={locationStatus === 'available' ? 'موقعي الحالي' : 'أظهر موقعي'}
          title={locationStatus === 'available' ? 'موقعي الحالي' : 'أظهر موقعي'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11" />
          </svg>
        </button>

        <button
          ref={toggleRef}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls={drawerId}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
          aria-label="المحطات القريبة"
          title="المحطات القريبة"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </button>
      </div>

      <div
        id={drawerId}
        role="region"
        aria-label="مواقف قريبة منك"
        // Closed, the drawer is only translated off-screen: inert keeps its
        // controls out of the tab order and the accessibility tree.
        inert={!isOpen}
        className={`absolute inset-x-0 bottom-0 z-30 transform rounded-t-2xl bg-[var(--surface)] p-4 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        dir="rtl"
        style={{ maxHeight: '50dvh' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">مواقف قريبة منك</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="إغلاق"
            className="rounded-full p-2 text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {drawerContent()}
      </div>
    </>
  )
}
