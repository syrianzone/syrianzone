import React, { Suspense, useMemo, useEffect, useRef, lazy } from 'react'
import citiesData from '../../_data/cities.json'
import { useMapData } from '../../_hooks/useMapData'
import { useMapStore } from '../../_store/useMapStore'
import type { City, FeatureCollection, RouteProperties, StopProperties } from '../../_types'
import TransitLayout from '../../layout'
import { Head } from '@inertiajs/react'

const cities = citiesData as City[]
const MapView = lazy(() => import('../../_components/citymap/MapView'))

interface CityPageProps {
  id: string
}

export default function CityPage({ id }: CityPageProps) {
  const city = cities.find((c) => c.id === id)
  const { data, loading, error } = useMapData(city?.id)
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  const isComposite = id === 'damascus' || id === 'rif-dimashq'
  const didSyncUrlRef = useRef(false)
  const prevCityIdRef = useRef(id)

  // A route selection must not leak across cities.
  useEffect(() => {
    if (prevCityIdRef.current !== id) {
      prevCityIdRef.current = id
      setSelectedRouteId(null)
    }
  }, [id, setSelectedRouteId])

  // Shareable selection URL: /transit/city/:id?route=:routeId. The URL is
  // authoritative on mount; afterwards selection changes push real history
  // entries and popstate restores the selection so Back/Forward walk it.
  useEffect(() => {
    const urlRoute = new URLSearchParams(window.location.search).get('route')
    if (!didSyncUrlRef.current) {
      didSyncUrlRef.current = true
      if (urlRoute !== selectedRouteId) setSelectedRouteId(urlRoute)
      return
    }
    const fresh = useMapStore.getState().selectedRouteId
    const target = fresh ? `/transit/city/${id}?route=${fresh}` : `/transit/city/${id}`
    if (window.location.pathname + window.location.search !== target) {
      window.history.pushState({ ...window.history.state }, '', target)
    }
  }, [id, selectedRouteId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onPop = () => {
      setSelectedRouteId(new URLSearchParams(window.location.search).get('route'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setSelectedRouteId])

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
        <meta
          name="description"
          content={isComposite
            ? 'خريطة تفاعلية لخطوط السرافيس ومواقف الباصات في دمشق الكبرى (دمشق وريف دمشق).'
            : `خريطة تفاعلية لخطوط السرافيس ومواقف الباصات في مدينة ${city.nameAr}.`}
        />
      </Head>
      <div className="relative h-full overflow-hidden">
        {isComposite && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 rounded-full bg-card/90 border border-border px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm pointer-events-none">
            تعرض هذه الخريطة خطوط دمشق الكبرى: دمشق وريف دمشق معاً.
          </div>
        )}
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
