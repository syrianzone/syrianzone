import React, { Suspense, useMemo, useEffect, useRef, lazy } from 'react'
import type { Bounds } from '@/Components/map/geo'
import { useMapData } from '../../_hooks/useMapData'
import { useMapStore } from '../../_store/useMapStore'
import type { FeatureCollection, RouteProperties, StopProperties } from '../../_types'
import type { TransitCity } from '@/Domain/transit/types'
import TransitLayout from '../../layout'

const MapView = lazy(() => import('../../_components/citymap/MapView'))

interface CityPageProps {
  id: string
  /** The city, from the same cached list the API serves (sent with the page). */
  city?: TransitCity
  /** The whole list, for the names of a shared map's other cities. */
  cities?: TransitCity[]
}

export default function CityPage({ id, city, cities = [] }: CityPageProps) {
  const { data, loading, error } = useMapData(city?.id)
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  const mapGroup = city?.mapGroup ?? [id]
  const isComposite = mapGroup.length > 1
  const groupNames = mapGroup.map((groupId) => cities.find((c) => c.id === groupId)?.nameAr ?? groupId)
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
    const target = selectedRouteId ? `/transit/city/${id}?route=${selectedRouteId}` : `/transit/city/${id}`
    if (window.location.pathname + window.location.search !== target) {
      window.history.pushState({ ...window.history.state }, '', target)
    }
  }, [id, selectedRouteId, setSelectedRouteId])

  useEffect(() => {
    const onPop = () => {
      setSelectedRouteId(new URLSearchParams(window.location.search).get('route'))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [setSelectedRouteId])

  const bounds = useMemo(() => {
    if (!city?.bounds) return null
    return city.bounds as Bounds
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
        <h1 className="sr-only">خريطة المدينة</h1>
        <div className="flex h-full items-center justify-center text-muted-foreground">
          المدينة غير موجودة
        </div>
      </TransitLayout>
    )
  }

  return (
    <TransitLayout>
      <h1 className="sr-only">مواصلات {city.nameAr}</h1>
      <div className="relative h-full overflow-hidden">
        {isComposite && city.mapGroupLabel && (
          // Below the search box (top-3 + a 36px field) so the two never overlap.
          <div className="pointer-events-none absolute inset-x-3 top-16 z-10 mx-auto max-w-md rounded-xl border border-border bg-card/90 px-3 py-1.5 text-center text-[11px] text-muted-foreground shadow-sm">
            تعرض هذه الخريطة خطوط {city.mapGroupLabel}: {groupNames.join(' و')} معاً.
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
