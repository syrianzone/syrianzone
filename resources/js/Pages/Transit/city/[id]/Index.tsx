import React, { Suspense, useMemo, useEffect, lazy } from 'react'
import citiesData from '../../_data/cities.json'
import { useMapData } from '../../_hooks/useMapData'
import { useMapStore } from '../../_store/useMapStore'
import type { City, FeatureCollection, RouteProperties, StopProperties } from '../../_types'
import TransitLayout from '../../layout'
import { Head, usePage } from '@inertiajs/react'

const cities = citiesData as City[]
const MapView = lazy(() => import('../../_components/citymap/MapView'))

interface CityPageProps {
  id: string
}

export default function CityPage({ id }: CityPageProps) {
  const { url } = usePage()
  const city = cities.find((c) => c.id === id)
  const { data, loading, error } = useMapData(city?.id)
  const { setSelectedRouteId } = useMapStore()

  // Support shareable links: /transit/city/:id?route=:routeId
  useEffect(() => {
    const searchParams = new URLSearchParams(url.split('?')[1] ?? '')
    const routeParam = searchParams.get('route')
    if (routeParam) {
      setSelectedRouteId(routeParam)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const bounds = useMemo(() => {
    if (!city?.bounds) return null
    return city.bounds as [[number, number], [number, number]]
  }, [city?.bounds])

  const routes: FeatureCollection<RouteProperties> = useMemo(() => {
    return data?.routes ?? { type: 'FeatureCollection', features: [] }
  }, [data])

  const stops: FeatureCollection<StopProperties> = useMemo(() => {
    return data?.stops ?? { type: 'FeatureCollection', features: [] }
  }, [data])

  if (!city || !city.bounds) {
    return (
      <TransitLayout>
        <Head>
          <title>المدينة غير موجودة - ترانزيت</title>
        </Head>
        <div className="flex h-full items-center justify-center text-muted-foreground">
          المدينة غير موجودة
        </div>
      </TransitLayout>
    )
  }

  return (
    <TransitLayout>
      <Head>
        <title>{`مواصلات ${city.nameAr} | ترانزيت`}</title>
        <meta name="description" content={`خريطة تفاعلية لخطوط السرافيس ومواقف الباصات في مدينة ${city.nameAr}.`} />
      </Head>
      <div className="relative h-full overflow-hidden">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="text-muted-foreground">جاري تحميل الخريطة...</div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="text-center text-destructive">
              <p className="mb-2">تعذر تحميل بيانات المدينة</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}

        {data && bounds && (
          <Suspense fallback={
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
              <div className="text-muted-foreground">جاري تحميل الخريطة...</div>
            </div>
          }>
            <MapView
              cityId={id}
              bounds={bounds}
              routes={routes}
              stops={stops}
            />
          </Suspense>
        )}
      </div>
    </TransitLayout>
  )
}
