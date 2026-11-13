import { useState, useEffect, useContext } from 'react'
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

  useEffect(() => {
    if (!userLocation || !isOpen) return

    const fetchNearby = async () => {
      setLoading(true)
      setFetchError(false)
      try {
        const rows = await transitApi.nearbyStops(userLocation.lat, userLocation.lng, NEARBY_STOPS_RADIUS_M)
        setStops(rows)
      } catch {
        setFetchError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchNearby()
  }, [userLocation, isOpen])

  // Clear results when drawer closes so stale data doesn't flash on reopen
  useEffect(() => {
    if (!isOpen) setStops([])
  }, [isOpen])

  const panToLocation = () => {
    if (map && userLocation) {
      map.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 16, essential: true })
    }
  }

  const drawerContent = () => {
    if (locationStatus === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-[var(--muted)]">
          <svg className="h-6 w-6 animate-spin text-[var(--gold)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          <svg className="h-6 w-6 animate-spin text-[var(--gold)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
          لا توجد مواقف في نطاق 500 متر
        </div>
      )
    }

    return (
      <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(50vh - 80px)' }}>
        {stops.map((stop) => (
          <div key={stop.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="mb-2 flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[var(--gold)]">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <h3 className="font-semibold text-[var(--text)]">{stop.nameAr}</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {stop.routes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => {
                    setSelectedRouteId(route.id)
                    setIsOpen(false)
                  }}
                  className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--text)] transition-colors hover:bg-[var(--gold)] hover:text-white"
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
      <div className="absolute bottom-[270px] end-4 z-20 flex flex-col gap-2 sm:bottom-6">
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
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)] text-white shadow-lg transition-transform hover:scale-105"
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
        className={`absolute inset-x-0 bottom-0 z-30 transform rounded-t-2xl bg-[var(--surface)] p-4 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        dir="rtl"
        style={{ maxHeight: '50vh' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">مواقف قريبة منك</h2>
          <button
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
