import { Link } from '@inertiajs/react'
import citiesData from '../../_data/cities.json'
import CityCard from './CityCard'
import type { City } from '../../_types'

interface CityGridProps {
  cities?: City[]
}

export default function CityGrid({ cities: propCities }: CityGridProps) {
  const cities = (propCities && propCities.length > 0 ? propCities : (citiesData as City[])).filter((c) => c.status === 'active')
  const ready = cities
    .filter((c) => c.routeCount > 0)
    .sort((a, b) => b.routeCount - a.routeCount)
  const pending = cities.filter((c) => c.routeCount === 0)

  return (
    <section className="px-4 pb-14 pt-8 sm:pt-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-lg font-bold text-[var(--text)] sm:text-xl">المدن المتاحة</h2>
          <span className="text-xs text-[var(--muted)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {ready.length} / {cities.length}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {ready.map((city, i) => (
            <CityCard key={city.id} city={city} index={i} />
          ))}
        </div>

        {/* Contribute CTA */}
        <Link
          href="/transit/studio"
          className="group mt-4 flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--border)] p-4 no-underline transition-colors duration-200 hover:border-[var(--gold)] hover:bg-[var(--surface)] sm:p-5"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--gold)] transition-colors duration-200 group-hover:bg-[var(--gold)] group-hover:text-[var(--surface)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <div className="flex flex-col items-start">
              <h3 className="text-base font-bold text-[var(--text)]">ساهم بإضافة خط</h3>
              <p className="text-xs text-[var(--muted)]">تعرف على مسار سيرفيس غير مسجّل؟ ارسمه على الخريطة</p>
            </div>
          </div>
          <svg
            className="shrink-0 text-[var(--muted)] transition-all duration-200 group-hover:-translate-x-1 group-hover:text-[var(--gold)]"
            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>

        {pending.length > 0 && (
          <div className="mt-10">
            <h3 className="mb-3 text-sm font-semibold text-[var(--muted)]">مدن قيد الإضافة</h3>
            <div className="flex flex-wrap gap-2">
              {pending.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)]"
                >
                  {c.nameAr}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
