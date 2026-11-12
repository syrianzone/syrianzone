import { useMemo, useEffect, useRef } from 'react'
import { usePage } from '@inertiajs/react'
import citiesData from '../_data/cities.json'
import { useRoutes, useMapData } from '../_hooks/useMapData'
import { useMapStore } from '../_store/useMapStore'
import type { City, RouteProperties } from '../_types'
import { SidebarRoutes } from './SidebarRoutes'
import { SidebarRouteDetail } from './SidebarRouteDetail'
import { SidebarMapTools } from './SidebarMapTools'

const cities = citiesData as City[]

interface TransitSidebarProps {
  pathname: string
  search: URLSearchParams
}

export function TransitSidebar({ pathname, search }: TransitSidebarProps) {
  const cityId = getCityIdFromPath(pathname)
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  const prevCityIdRef = useRef(cityId)

  // The city page carries its own route list; any other transit page has none.
  const page = usePage<{ id?: string; routes?: RouteProperties[] }>().props
  const { data: routes } = useRoutes(cityId || '', page.id === cityId ? page.routes : undefined)
  const { data: mapData } = useMapData(cityId || undefined)

  const city = useMemo(() => cities.find(c => c.id === cityId), [cityId])
  const route = useMemo(
    () => routes?.find(r => r.id === selectedRouteId),
    [routes, selectedRouteId]
  )

  // Clear route selection only when navigating to a DIFFERENT city (not on initial mount)
  useEffect(() => {
    if (prevCityIdRef.current !== cityId) {
      prevCityIdRef.current = cityId
      setSelectedRouteId(null)
    }
  }, [cityId, setSelectedRouteId])

  if (!cityId) return null

  if (selectedRouteId && route) {
    const stops = mapData?.stops.features.filter(f =>
      Array.isArray(f.properties.routeIds) && f.properties.routeIds.includes(selectedRouteId)
    ) ?? []
    return <SidebarRouteDetail route={route} city={city} stops={stops} />
  }

  return <SidebarRoutes city={city} routes={routes ?? []} />
}

function getCityIdFromPath(path: string): string | null {
  const match = path.match(/^\/transit\/city\/([^/]+)/)
  return match ? match[1] : null
}
