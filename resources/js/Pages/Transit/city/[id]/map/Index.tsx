import React, { Suspense, useEffect, useMemo, lazy } from 'react'
import citiesData from '../../../_data/cities.json'
import { useMapData } from '../../../_hooks/useMapData'
import type { City, FeatureCollection, RouteProperties, StopProperties } from '../../../_types'
import TransitLayout from '../../../layout'
import { Head, usePage } from '@inertiajs/react'

const cities = citiesData as City[]

// Lazy-load the entire map chunk strictly in the client/browser environment using lazy
const MapView = lazy(() => import('../../../_components/citymap/MapView'))

interface CityMapPageProps {
  id: string
}

function CityMapPageContent({ id }: CityMapPageProps) {
  const { url } = usePage()

  const routeId = useMemo(() => {
    const searchParams = new URLSearchParams(url.split('?')[1] ?? '')
    return searchParams.get('route')
  }, [url])

  const city = cities.find((c) => c.id === id)
  const { data, loading, error } = useMapData(city?.id)

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
      <div className="flex h-full flex-col bg-[var(--bg)]">
        <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
          المدينة غير موجودة
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--bg)]">

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
              fitToData={!!routeId}
            />
          </Suspense>
        )}
      </div>
    </div>
  )
}

export default function CityMapPage({ id }: CityMapPageProps) {
  const city = cities.find((c) => c.id === id)

  return (
    <TransitLayout>
      <Head>
        <title>{city ? `خريطة مواصلات ${city.nameAr} التفاعلية | ترانزيت` : 'المدينة غير موجودة - ترانزيت'}</title>
        <meta name="description" content={city ? `خريطة تفاعلية كاملة لخطوط السرافيس ومواقف الباصات في مدينة ${city.nameAr} لمعرفة خطوط السير ومسارات المواصلات.` : 'خريطة مواصلات المدينة المطلوبة غير متوفرة.'} />
      </Head>
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
