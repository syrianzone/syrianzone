import { useMemo, useEffect, useRef } from 'react'
import { usePage } from '@inertiajs/react'
import { useRoutes, useMapData } from '../_hooks/useMapData'
import { useMapStore } from '../_store/useMapStore'
import type { RouteProperties } from '../_types'
import type { TransitCity } from '@/Domain/transit/types'
import { SidebarRoutes } from './SidebarRoutes'
import { SidebarRouteDetail } from './SidebarRouteDetail'

interface TransitSidebarProps {
  pathname: string
}

export function TransitSidebar({ pathname }: TransitSidebarProps) {
  const cityId = getCityIdFromPath(pathname)
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  const prevCityIdRef = useRef(cityId)

  // The city page carries its own route list; any other transit page has none.
  // The city list is a page prop on every transit page (the server renders it
  // from the table), so the sidebar names a city without a fetch of its own.
  const page = usePage<{ id?: string; routes?: RouteProperties[]; cities?: TransitCity[] }>().props
  const cities = page.cities ?? []
  const { data: routes } = useRoutes(cityId || '', page.id === cityId ? page.routes : undefined)
  const { data: mapData } = useMapData(cityId || undefined)

  const city = useMemo(() => cities.find(c => c.id === cityId), [cities, cityId])
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

  return <SidebarRoutes city={city} cities={cities} routes={routes ?? []} />
}

function getCityIdFromPath(path: string): string | null {
  const match = path.match(/^\/transit\/city\/([^/]+)/)
  return match ? match[1] : null
}
