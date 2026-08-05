'use client'

import { useEffect, useState, createContext, useContext } from 'react'
import type maplibregl from 'maplibre-gl'
import { MapCanvas as SharedMapCanvas } from '@/Components/map/MapCanvas'
import { useMap } from '@/Components/map/MapContext'
import { useTransitTheme } from '../TransitThemeContext'
import { THEME_REGISTRY } from '@/Lib/theme'

export const LocationContext = createContext<{ lng: number; lat: number } | null>(null)
export const LocationStatusContext = createContext<'idle' | 'loading' | 'available' | 'denied'>('idle')

export function useUserLocation() {
  return useContext(LocationContext)
}

interface MapCanvasProps {
  bounds: [[number, number], [number, number]]
  children?: React.ReactNode
}

function Geolocator({ children }: { children: React.ReactNode }) {
  const map = useMap()
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'available' | 'denied'>('idle')

  useEffect(() => {
    if (!map) return
    let watchId: number | null = null

    if ('geolocation' in navigator) {
      setLocationStatus('loading')
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocationStatus('available')
          setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude })
        },
        () => setLocationStatus('denied'),
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
      )
    } else {
      setLocationStatus('denied')
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [map])

  return (
    <LocationContext.Provider value={userLocation}>
      <LocationStatusContext.Provider value={locationStatus}>
        {children}
      </LocationStatusContext.Provider>
    </LocationContext.Provider>
  )
}

export default function MapCanvas({ bounds, children }: MapCanvasProps) {
  const { theme } = useTransitTheme()
  const dark = THEME_REGISTRY.find((t) => t.id === theme)?.isDark ?? true

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
      className="absolute inset-0"
    >
      <Geolocator>{children}</Geolocator>
    </SharedMapCanvas>
  )
}
