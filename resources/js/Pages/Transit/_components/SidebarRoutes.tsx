'use client'

import { Link } from '@inertiajs/react'
import { MapPin, ChevronRight, Plus } from 'lucide-react'
import { useAuth } from '@/Contexts/AuthContext'
import { Button } from '@/Components/ui/button'
import { ScrollArea } from '@/Components/ui/scroll-area'
import { Separator } from '@/Components/ui/separator'
import { useMapStore } from '../_store/useMapStore'
import { getRouteColor } from '../_lib/mapColors'

interface SidebarRoutesProps {
  city: { id: string; nameAr: string } | undefined
  routes: any[]
}

export function SidebarRoutes({ city, routes }: SidebarRoutesProps) {
  const { user } = useAuth()
  const { selectedRouteId, setSelectedRouteId } = useMapStore()
  if (!city) return null

  const handleRouteClick = (routeId: string) => {
    setSelectedRouteId(routeId)
    window.history.replaceState({}, '', `/transit/city/${city.id}/route/${routeId}`)
  }

  const handleBack = () => {
    setSelectedRouteId(null)
    window.history.replaceState({}, '', `/transit/city/${city.id}`)
  }

  const isDamascusRegion = city.id === 'damascus' || city.id === 'rif-dimashq'
  const damascusRoutes = isDamascusRegion ? routes.filter(r => (r.cityId ?? 'damascus') === 'damascus') : []
  const rifRoutes = isDamascusRegion ? routes.filter(r => r.cityId === 'rif-dimashq') : []

  const renderRouteCard = (route: any) => (
    <button
      key={route.id}
      onClick={() => handleRouteClick(route.id)}
      className={`group flex items-stretch rounded-xl border transition-all duration-200 hover:shadow-sm overflow-hidden w-full text-start ${
        selectedRouteId === route.id
          ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/20'
          : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      <span
        className="w-1 shrink-0 transition-all duration-200 group-hover:w-1.5"
        style={{ backgroundColor: getRouteColor(route.colorIndex) }}
      />
      <div className="flex-1 min-w-0 p-4">
        <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug break-words">
          {route.nameAr}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {route.stopsCount !== undefined && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 opacity-65" />
              <span>{route.stopsCount.toLocaleString('ar-SY')} موقف</span>
            </span>
          )}
          {route.stopsCount !== undefined && route.priceNew > 0 && (
            <span className="opacity-40">•</span>
          )}
          {route.priceNew > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
              <span>{route.priceNew.toLocaleString('ar-SY')} ل.س</span>
            </span>
          )}
        </div>
      </div>
    </button>
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="p-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/transit" aria-label="رجوع للمدن">
              <ChevronRight className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground">{city.nameAr}</h2>
            <p className="text-xs text-muted-foreground">{routes.length} خط سيرفيس</p>
          </div>
        </div>

        {user && (
          <Button asChild className="mt-3 w-full" size="sm">
            <Link href="/transit/studio">
              <Plus className="h-4 w-4" />
              إضافة مسار
            </Link>
          </Button>
        )}
      </div>

      <Separator />

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {isDamascusRegion ? (
            <>
              {damascusRoutes.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>دمشق</span>
                    <span className="text-xs font-normal text-muted-foreground">({damascusRoutes.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {damascusRoutes.map(renderRouteCard)}
                  </div>
                </div>
              )}

              {rifRoutes.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span>ريف دمشق</span>
                    <span className="text-xs font-normal text-muted-foreground">({rifRoutes.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {rifRoutes.map(renderRouteCard)}
                  </div>
                </div>
              )}

              {damascusRoutes.length === 0 && rifRoutes.length === 0 && (
                <div className="flex items-center justify-center text-muted-foreground py-8">
                  لا توجد خطوط متاحة
                </div>
              )}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {routes.map(renderRouteCard)}
              </div>
              {routes.length === 0 && (
                <div className="flex items-center justify-center text-muted-foreground py-8">
                  لا توجد خطوط متاحة
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
