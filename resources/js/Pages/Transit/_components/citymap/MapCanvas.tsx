import { useCallback, useEffect, useRef, useState, createContext, useContext } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapCanvas as SharedMapCanvas } from '@/Components/map/MapCanvas'
import { useMap } from '@/Components/map/MapContext'
import type { Bounds } from '@/Components/map/geo'
import { notify } from '@/Lib/notify'

export type LocationStatus = 'idle' | 'loading' | 'available' | 'denied'

export const LocationContext = createContext<{ lng: number; lat: number } | null>(null)
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

function Geolocator({ children }: { children: React.ReactNode }) {
  const map = useMap()
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle')
  const watchIdRef = useRef<number | null>(null)

  const stopWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
  }, [])

  const startWatch = useCallback(() => {
    if (watchIdRef.current !== null) return

    if (!('geolocation' in navigator)) {
      setLocationStatus('denied')
      notify.error('متصفحك لا يدعم تحديد الموقع')
      return
    }

    setLocationStatus('loading')
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationStatus('available')
        setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude })
      },
      () => {
        stopWatch()
        setLocationStatus('denied')
        notify.error('تعذر تحديد موقعك، تحقق من إذن الموقع في المتصفح')
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    )
  }, [stopWatch])

  // Only a visitor who already granted location is watched on load (that path
  // shows no prompt). "prompt", "denied" and browsers without the Permissions
  // API all wait for the map control instead of asking every visitor.
  useEffect(() => {
    if (!map || !navigator.permissions?.query) return

    let cancelled = false

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (cancelled || status.state !== 'granted') return
        startWatch()
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
        <LocationRequestContext.Provider value={startWatch}>
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
