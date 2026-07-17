'use client'

import { Link } from '@inertiajs/react'
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
            className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition-colors hover:border-primary/30"
          >
            {/* Title & Metadata */}
            <div className="flex items-start gap-3 flex-1 min-w-0" dir="rtl">
              <span
                className="h-10 w-1.5 shrink-0 rounded-full mt-1"
                style={{ backgroundColor: getRouteColor(route.colorIndex) }}
              />
              <div className="flex-1 min-w-0 text-right">
                <h3 className="text-sm sm:text-base font-semibold text-foreground leading-snug break-words">
                  {route.nameAr}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  {route.nameEn && <span className="font-medium">{route.nameEn}</span>}
                  {route.nameEn && (route.stopsCount !== undefined || route.priceNew > 0) && (
                    <span className="opacity-40">•</span>
                  )}
                  {route.stopsCount !== undefined && (
                    <span>{route.stopsCount.toLocaleString('ar-SY')} موقف</span>
                  )}
                  {route.stopsCount !== undefined && route.priceNew > 0 && (
                    <span className="opacity-40">•</span>
                  )}
                  {route.priceNew > 0 && (
                    <span className="font-bold text-[var(--gold)]">
                      {route.priceNew.toLocaleString('ar-SY')} ل.س
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 justify-end w-full md:w-auto" dir="rtl">
              <Button asChild variant="outline" size="sm" className="flex-1 md:flex-none text-xs h-9">
                <Link href={`/transit/city/${cityId}/route/${route.id}`}>
                  عرض المواقف
                </Link>
              </Button>
              <Button asChild size="sm" className="flex-1 md:flex-none text-xs h-9 bg-primary text-primary-foreground hover:bg-primary/95">
                <Link href={`/transit/city/${cityId}/map?route=${route.id}`}>
                  عرض على الخريطة
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <Link
          href={`/transit/city/${cityId}/map`}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hover)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="1 6 1 22 8 18 16 22 21 18 21 2 16 6 8 2 1 6" />
            <line x1="8" y1="2" x2="8" y2="18" />
            <line x1="16" y1="6" x2="16" y2="22" />
          </svg>
          عرض الكل على الخريطة
        </Link>
      </div>
    </>
  )
}
