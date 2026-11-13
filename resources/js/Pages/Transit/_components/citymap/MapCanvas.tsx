import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapCanvas as SharedMapCanvas } from '@/Components/map/MapCanvas'
import { useMap } from '@/Components/map/MapContext'
import type { Bounds } from '@/Components/map/geo'
import { notify } from '@/Lib/notify'
import { LOC_CHANGED_EVENT, getGeo, gpsAvailable, resolveGps, setGeo } from '@/Domain/location/location'

export type LocationStatus = 'idle' | 'loading' | 'available' | 'denied'

interface Point {
  lng: number
  lat: number
}

export const LocationContext = createContext<Point | null>(null)
export const LocationStatusContext = createContext<LocationStatus>('idle')
export const LocationRequestContext = createContext<() => void>(() => undefined)

export function useUserLocation() {
  return useContext(LocationContext)
}

// «أظهر موقعي»: the map asks for a fix only when the visitor presses it.
export function useRequestUserLocation() {
  return useContext(LocationRequestContext)
}

interface MapCanvasProps {
  bounds: Bounds
  children?: React.ReactNode
}

/**
 * The point `Domain/location` already knows about, in map coordinates. The map
 * does not own the user's location: a fix resolved anywhere (this map, settings)
 * is stored as one shared point and every surface reads it.
 */
function storedLocation(): Point | null {
  const geo = getGeo()
  return geo ? { lng: geo.lon, lat: geo.lat } : null
}

function Geolocator({ children }: { children: React.ReactNode }) {
  const map = useMap()
  const [userLocation, setUserLocation] = useState<Point | null>(storedLocation)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>(
    () => (storedLocation() === null ? 'idle' : 'available'),
  )
  const watchIdRef = useRef<number | null>(null)

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  // Live updates for the dot while the visitor stays on the map. Failures are
  // silent: the fix that started the watch is already on screen, and the
  // request that produced it is what reports a refused permission.
  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null || !gpsAvailable()) return

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationStatus('available')
        setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude })
      },
      stopWatch,
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    )
  }, [stopWatch])

  const requestLocation = useCallback(async () => {
    setLocationStatus('loading')
    try {
      // The shared request: permission handling, retries and the Arabic refusal
      // live in Domain/location, and the resolved point is stored there as the
      // last GPS fix. It does not switch the prayer or weather mode: where those
      // surfaces take their coordinates from is the user's own choice.
      setGeo(await resolveGps())
      startWatch()
    } catch (e) {
      setLocationStatus('denied')
      notify.error(e instanceof Error ? e.message : 'تعذر تحديد موقعك، تحقق من إذن الموقع في المتصفح')
    }
  }, [startWatch])

  // The control is a plain callback; the request itself is a promise whose
  // outcome is already reported through the status and the toast.
  const requestLocationFromControl = useCallback(() => {
    void requestLocation()
  }, [requestLocation])

  // A point resolved elsewhere (the settings' GPS option, another tab) reaches
  // the map the same way it reaches the timings.
  useEffect(() => {
    const sync = () => {
      const point = storedLocation()
      setUserLocation(point)
      if (point !== null) setLocationStatus('available')
    }

    window.addEventListener(LOC_CHANGED_EVENT, sync)
    return () => window.removeEventListener(LOC_CHANGED_EVENT, sync)
  }, [])

  // Only a visitor who already granted location is asked on load (that path
  // shows no prompt). "prompt", "denied" and browsers without the Permissions
  // API all wait for the map control instead of asking every visitor.
  useEffect(() => {
    if (!map || !navigator.permissions?.query) return

    let cancelled = false

    navigator.permissions
      .query({ name: 'geolocation' })
      .then(async (status) => {
        if (cancelled || status.state !== 'granted') return
        try {
          setGeo(await resolveGps())
          if (!cancelled) startWatch()
        } catch {
          // A silent preflight: nothing was on screen to explain.
        }
      })
      .catch(() => {
        // permission name unsupported: behave like "prompt"
      })

    return () => {
      cancelled = true
    }
  }, [map, startWatch])

  useEffect(() => stopWatch, [stopWatch])

  return (
    <LocationContext.Provider value={userLocation}>
      <LocationStatusContext.Provider value={locationStatus}>
        <LocationRequestContext.Provider value={requestLocationFromControl}>
          {children}
        </LocationRequestContext.Provider>
      </LocationStatusContext.Provider>
    </LocationContext.Provider>
  )
}

export default function MapCanvas({ bounds, children }: MapCanvasProps) {
  const lngPad = (bounds[1][0] - bounds[0][0]) * 0.6
  const latPad = (bounds[1][1] - bounds[0][1]) * 0.6
  const maxBounds: maplibregl.LngLatBoundsLike = [
    [bounds[0][0] - lngPad, bounds[0][1] - latPad],
    [bounds[1][0] + lngPad, bounds[1][1] + latPad],
  ]

  return (
    <SharedMapCanvas
      bounds={bounds}
      maxBounds={maxBounds}
      minZoom={8}
      maxZoom={18}
      controls="bottom-right"
      className="absolute inset-0"
    >
      <Geolocator>{children}</Geolocator>
    </SharedMapCanvas>
  )
}
