'use client'

import { Link } from '@inertiajs/react'
import { useRoutes } from '../../../_hooks/useMapData'
import { getRouteColor } from '../../../_lib/mapColors'

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
          <Link
            key={route.id}
            href={`/transit/city/${cityId}/route/${route.id}`}
            className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-hover)]"
          >
            <span
              className="h-10 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: getRouteColor(route.colorIndex) }}
            />
            <div className="flex-1">
              <h3 className="text-base font-semibold text-[var(--text)]">{route.nameAr}</h3>
              {route.nameEn && <p className="text-xs text-[var(--muted)]">{route.nameEn}</p>}
            </div>
          </Link>
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
