import React, { Suspense, useMemo, lazy } from 'react'
import { Head } from '@inertiajs/react'
import type { City, FeatureCollection, RouteProperties, StopProperties } from '../../../../_types'
import TransitLayout from '../../../../layout'

const MapView = lazy(() => import('../../../../_components/citymap/MapView'))

interface RoutePageProps {
  id: string
  city: City | null
  route: RouteProperties | null
  stops: { properties: StopProperties; coordinates: [number, number] }[]
  geometry: any
}

export default function RoutePage({ id, city, route, stops = [], geometry }: RoutePageProps) {
  const bounds = useMemo(() => {
    if (!city?.bounds) return null
    return city.bounds as [[number, number], [number, number]]
  }, [city?.bounds])

  const routes: FeatureCollection<RouteProperties> = useMemo(() => {
    if (!route || !geometry) return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: route,
        geometry,
      }],
    }
  }, [route, geometry])

  const stopsCollection: FeatureCollection<StopProperties> = useMemo(() => {
    if (!stops.length) return { type: 'FeatureCollection', features: [] }
    return {
      type: 'FeatureCollection',
      features: stops.map(s => ({
        type: 'Feature',
        properties: s.properties,
        geometry: { type: 'Point' as const, coordinates: s.coordinates },
      })),
    }
  }, [stops])

  if (!city || !route) {
    return (
      <TransitLayout>
        <Head>
          <title>الخط غير موجود - ترانزيت</title>
        </Head>
        <div className="flex h-full items-center justify-center text-muted-foreground">
          الخط غير موجود
        </div>
      </TransitLayout>
    )
  }

  return (
    <TransitLayout>
      <Head>
        <title>{`${route.nameAr} (${city.nameAr}) | ترانزيت`}</title>
        <meta name="description" content={`مسار ومواقف خط سيرفيس ${route.nameAr} في مدينة ${city.nameAr} مع خريطة تفاعلية.`} />
      </Head>
      <div className="relative h-full overflow-hidden">
        {!geometry && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="text-muted-foreground">لا توجد بيانات مسار لهذه الخط</div>
          </div>
        )}

        {geometry && (
          <Suspense fallback={
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
              <div className="text-muted-foreground">جاري تحميل الخريطة...</div>
            </div>
          }>
            <MapView
              cityId={id}
              bounds={bounds!}
              routes={routes}
              stops={stopsCollection}
              fitToData
            />
          </Suspense>
        )}
      </div>
    </TransitLayout>
  )
}
