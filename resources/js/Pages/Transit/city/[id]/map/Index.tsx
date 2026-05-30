import React, { Suspense, useEffect, useMemo, lazy, useState } from 'react'
import citiesData from '../../../_data/cities.json'
import { useMapData } from '../../../_hooks/useMapData'
import { useOffline } from '../../../_hooks/useOffline'
import Header from '../../../_components/layout/Header'
import OfflineBanner from '../../../_components/citymap/OfflineBanner'
import type { City, FeatureCollection, RouteProperties, StopProperties } from '../../../_types'
import TransitLayout from '../../../layout'

const cities = citiesData as City[]

// Lazy-load the entire map chunk strictly in the client/browser environment using lazy
const MapView = lazy(() => import('../../../_components/citymap/MapView'))

interface CityMapPageProps {
  id: string
}

function CityMapPageContent({ id }: CityMapPageProps) {
  const [routeId, setRouteId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      setRouteId(searchParams.get('route'))
    }
  }, [])

  const city = cities.find((c) => c.id === id)
  const { data, loading, error } = useMapData(city?.id)
  const isOffline = useOffline()

  const bounds = useMemo(() => {
    if (!city?.bounds) return null
    return city.bounds as [[number, number], [number, number]]
  }, [city?.bounds])

  const filteredRoutes: FeatureCollection<RouteProperties> = useMemo(() => {
    if (!data) return { type: 'FeatureCollection', features: [] }
    if (!routeId) return data.routes
    const feature = data.routes.features.find((f) => f.properties.id === routeId)
    return {
      type: 'FeatureCollection',
      generated_at: data.routes.generated_at,
      features: feature ? [feature] : [],
    }
  }, [data, routeId])

  const filteredStops: FeatureCollection<StopProperties> = useMemo(() => {
    if (!data) return { type: 'FeatureCollection', features: [] }
    if (!routeId) return data.stops
    const stops = data.stops.features.filter(
      (f) => Array.isArray(f.properties.routeIds) && f.properties.routeIds.includes(routeId!)
    )
    return {
      type: 'FeatureCollection',
      generated_at: data.stops.generated_at,
      features: stops,
    }
  }, [data, routeId])

  useEffect(() => {
    if (!city) return
    document.title = `${city.nameAr} — ترانزيت`
    return () => {
      document.title = 'ترانزيت — Syria Transit'
    }
  }, [city])

  if (!city || !city.bounds) {
    return (
      <div className="flex h-svh flex-col bg-[var(--bg)]">
        <Header />
        <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
          المدينة غير موجودة
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-svh flex-col bg-[var(--bg)]">
      <Header />
      {isOffline && <OfflineBanner />}

      <div className="relative flex-1 overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]">
            <div className="text-[var(--muted)]">جاري تحميل الخريطة...</div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]">
            <div className="text-center text-[var(--pomegranate)]">
              <p className="mb-2">تعذر تحميل بيانات المدينة</p>
              <p className="text-sm text-[var(--muted)]">{error}</p>
            </div>
          </div>
        )}

        {data && bounds && (
          <Suspense fallback={
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]">
              <div className="text-[var(--muted)]">جاري تحميل الخريطة...</div>
            </div>
          }>
            <MapView
              cityId={id}
              bounds={bounds}
              routes={filteredRoutes}
              stops={filteredStops}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

export default function CityMapPage({ id }: CityMapPageProps) {
  return (
    <TransitLayout>
      <Suspense fallback={
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]">
          <div className="text-[var(--muted)]">جاري تحميل الخريطة...</div>
        </div>
      }>
        <CityMapPageContent id={id} />
      </Suspense>
    </TransitLayout>
  )
}
