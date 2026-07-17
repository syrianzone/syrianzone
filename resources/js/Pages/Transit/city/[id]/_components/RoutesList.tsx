'use client'

import { Link } from '@inertiajs/react'
import { Bus, MapPin, Map } from 'lucide-react'
import { useRoutes } from '../../../_hooks/useMapData'
import { getRouteColor } from '../../../_lib/mapColors'
import { Button } from '@/components/ui/button'

interface RoutesListProps {
  cityId: string
}

function RouteSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="h-10 w-1.5 shrink-0 rounded-full bg-[var(--surface-2)]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-1/3 rounded bg-[var(--surface-2)]" />
      </div>
    </div>
  )
}

export default function RoutesList({ cityId }: RoutesListProps) {
  const { data: routes, isLoading, error } = useRoutes(cityId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <RouteSkeleton key={i} />)}
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-12 text-center text-sm text-[var(--pomegranate)]">
        تعذر تحميل الخطوط، حاول مجدداً
      </div>
    )
  }

  if (!routes || routes.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--muted)]">لا توجد خطوط متاحة</div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {routes.map((route) => (
          <div
            key={route.id}
            className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)] transition-all duration-200 hover:border-primary/40 hover:shadow-sm"
          >
            {/* Card Body Link (clickable details area) */}
            <Link
              href={`/transit/city/${cityId}/route/${route.id}`}
              className="flex items-start gap-3 flex-1 min-w-0 pr-4 py-4 pl-2 no-underline text-right"
              dir="rtl"
            >
              {/* Colored Badge */}
              <span
                className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: getRouteColor(route.colorIndex) }}
              >
                <Bus className="h-5 w-5" />
              </span>
              
              {/* Title & Metadata */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug break-words">
                  {route.nameAr}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  {route.nameEn && <span className="font-medium">{route.nameEn}</span>}
                  {route.nameEn && (route.stopsCount !== undefined || route.priceNew > 0) && (
                    <span className="opacity-40">•</span>
                  )}
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
                    <span className="flex items-center gap-1 rounded-full bg-[var(--gold)]/10 px-2 py-0.5 font-bold text-[var(--gold)]">
                      <span>{route.priceNew.toLocaleString('ar-SY')} ل.س</span>
                    </span>
                  )}
                </div>
              </div>
            </Link>

            {/* Map Action Button */}
            <div className="pl-4 py-4 pr-2 shrink-0 flex items-center justify-center">
              <Button
                asChild
                size="icon"
                className="h-11 w-11 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200"
              >
                <Link href={`/transit/city/${cityId}/map?route=${route.id}`} title="عرض على الخريطة">
                  <Map className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
