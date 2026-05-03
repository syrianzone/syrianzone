'use client'

import { useEffect, useRef, useState, createContext, useContext } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapContext } from './MapContext'

export const LocationContext = createContext<{ lng: number; lat: number } | null>(null)

export function useUserLocation() {
  return useContext(LocationContext)
}

interface MapCanvasProps {
  bounds: [[number, number], [number, number]]
  children?: React.ReactNode
}

export default function MapCanvas({ bounds, children }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<maplibregl.Map | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const lngPad = (bounds[1][0] - bounds[0][0]) * 0.6
    const latPad = (bounds[1][1] - bounds[0][1]) * 0.6
    const maxBounds: maplibregl.LngLatBoundsLike = [
      [bounds[0][0] - lngPad, bounds[0][1] - latPad],
      [bounds[1][0] + lngPad, bounds[1][1] + latPad],
    ]

    const instance = new maplibregl.Map({
      container: containerRef.current,
      style: '/styles/styles/dark-matter.json',
      bounds: bounds as maplibregl.LngLatBoundsLike,
      fitBoundsOptions: { padding: 60 },
      maxBounds,
      minZoom: 8,
      maxZoom: 18,
    })

    instance.on('load', () => {
      setMap(instance)
    })

    instance.on('error', (e: maplibregl.ErrorEvent) => {
      console.error('MapLibre error:', e)
      setError('تعذر تحميل الخريطة')
    })

    return () => {
      instance.remove()
      setMap(null)
      setError(null)
    }
  }, [bounds])

  useEffect(() => {
    if (!map) return

    let watchId: number | null = null

    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setUserLocation({
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
          })
        },
        (err) => {
          console.warn('Geolocation error:', err)
        },
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
      )
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [map])

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[var(--bg)]/90">
          <div className="text-center text-[var(--pomegranate)]">
            <p className="mb-2">{error}</p>
            <p className="text-sm text-[var(--muted)]">تحقق من اتصالك بالإنترنت</p>
          </div>
        </div>
      )}
      <MapContext.Provider value={map}>
        <LocationContext.Provider value={userLocation}>
          {map ? children : null}
        </LocationContext.Provider>
      </MapContext.Provider>
    </div>
  )
}
