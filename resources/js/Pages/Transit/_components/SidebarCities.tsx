'use client'

import { Link } from '@inertiajs/react'
import type { City } from '../_types'

interface SidebarCitiesProps {
  cities: City[]
}

export function SidebarCities({ cities }: SidebarCitiesProps) {
  const activeCities = cities.filter(c => c.status === 'active')
  const comingSoon = cities.filter(c => c.status === 'coming_soon')

  return (
    <div className="p-4 space-y-4 h-full flex flex-col" dir="rtl">
      <h3 className="text-sm font-bold text-[var(--text)]">المدن المتاحة</h3>
      <div className="space-y-2 flex-1 overflow-y-auto">
        {activeCities.map(city => (
          <Link
            key={city.id}
            href={`/transit/city/${city.id}`}
            className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-primary/40 hover:shadow-sm"
            dir="rtl"
          >
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-semibold text-[var(--text)] leading-snug">{city.nameAr}</p>
              <p className="text-xs text-[var(--muted)]">{city.routeCount} خط سيرفيس</p>
            </div>
          </Link>
        ))}
        {comingSoon.map(city => (
          <div key={city.id} className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3 opacity-60">
            <div className="flex-1 min-w-0 text-right">
              <p className="text-sm font-semibold text-[var(--text)] leading-snug">{city.nameAr}</p>
              <p className="text-xs text-[var(--muted)]">قريباً</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}