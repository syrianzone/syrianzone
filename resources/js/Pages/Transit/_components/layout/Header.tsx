'use client'

import { usePage, Link } from '@inertiajs/react'
import citiesData from '../../_data/cities.json'
import type { City } from '../../_types'
import { useTransitTheme } from '../TransitThemeContext'

const cities = citiesData as City[]

export default function Header() {
  const { url: pathname } = usePage()
  const city = cities.find((c) => pathname?.startsWith(`/transit/city/${c.id}`))
  const isCityPage = pathname?.startsWith('/transit/city/') ?? false
  const { theme, toggleTheme } = useTransitTheme()

  const backLink = (() => {
    if (!city) return '/transit'
    if (pathname === `/transit/city/${city.id}/map`) return `/transit/city/${city.id}`
    if (pathname?.startsWith(`/transit/city/${city.id}/route/`)) return `/transit/city/${city.id}`
    return '/transit'
  })()

  if (!isCityPage || !city) return null

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-2" dir="rtl">
        <div className="flex items-center gap-3">
          <Link
            href={backLink}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--gold)] transition-colors hover:bg-[var(--border)]"
            aria-label="العودة"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <div className="text-right">
            <h1 className="text-sm font-bold text-[var(--text)]">{city.nameAr}</h1>
            <p className="text-[10px] text-[var(--muted)]">{city.nameEn}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
