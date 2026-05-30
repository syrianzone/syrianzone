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

  const isJasmine = theme === 'jasmine'

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        {isCityPage && city ? (
          <div className="flex items-center gap-3">
            <Link
              href={backLink}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--gold)] transition-colors hover:bg-[var(--surface-2)]"
              aria-label="العودة"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </Link>
            <div>
              <h1 className="text-base font-bold text-[var(--text)]">{city.nameAr}</h1>
              <p className="text-xs text-[var(--muted)]">{city.nameEn}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tracking-wide text-[var(--gold)]">SYRIAN.ZONE</span>
            <span className="text-xs text-[var(--muted)]">/</span>
            <span className="text-base font-bold text-[var(--text)]">ترانزيت</span>
          </div>
        )}

        <button
          onClick={toggleTheme}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--gold)] transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--surface-2)]"
          aria-label={isJasmine ? 'التبديل إلى وردة دمشق' : 'التبديل إلى الياسمين'}
          title={isJasmine ? 'وردة دمشق' : 'الياسمين'}
        >
          {isJasmine ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}
