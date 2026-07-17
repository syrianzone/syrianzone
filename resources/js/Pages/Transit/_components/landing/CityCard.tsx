import { Link } from '@inertiajs/react'
import type { City } from '../../_types'
import { usePreloadCity } from '../../_hooks/useMapData'
import { GOVERNORATE_SVGS } from '../../_data/governorate_svgs'

interface CityCardProps {
  city: City
  index: number
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  )
}

function getGovSvgKey(cityId: string): string {
  const mapping: Record<string, string> = {
    'damascus': 'damascus',
    'rif-dimashq': 'rif dimashq',
    'aleppo': 'aleppo',
    'homs': 'homs',
    'hama': 'hamah',
    'idlib': 'idlib',
    'lattakia': 'lattakia',
    'tartus': 'tartus',
    'daraa': 'dar`a',
    'sweida': 'as suwayda',
    'quneitra': 'quneitra',
    'deir-ez-zor': 'dayr az zawr',
    'raqqa': 'ar raqqah',
    'hasakah': 'al ḥasakah',
  }
  return mapping[cityId] || cityId
}

function GovernorateIcon({ cityId }: { cityId: string }) {
  const svgKey = getGovSvgKey(cityId)
  const svgData = GOVERNORATE_SVGS[svgKey]

  if (!svgData) {
    return <PinIcon />
  }

  return (
    <svg
      viewBox={svgData.viewBox}
      className="h-6 w-6 transition-transform duration-300 group-hover:scale-110"
      style={{
        width: '24px',
        height: '24px',
        fill: 'currentColor',
      }}
      aria-hidden="true"
    >
      <path d={svgData.path} />
    </svg>
  )
}

export default function CityCard({ city, index }: CityCardProps) {
  // A city is "ready" once it actually has routes mapped — those get the full
  // interactive treatment; the rest read as on-the-way.
  const isReady = city.status === 'active' && city.routeCount > 0
  const preloadCityData = usePreloadCity()

  const base =
    'city-card group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-200 sm:p-5'

  if (!isReady) {
    return (
      <div
        className={`${base} is-pending opacity-55`}
        style={{ animationDelay: `${index * 70}ms` }}
        aria-disabled="true"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
            <GovernorateIcon cityId={city.id} />
          </span>
          <div className="flex flex-col items-start">
            <h3 className="text-lg font-bold text-[var(--text)] sm:text-xl">{city.nameAr}</h3>
            <p className="text-xs text-[var(--muted)]">{city.nameEn}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          قريباً
        </span>
      </div>
    )
  }

  return (
    <Link
      href={`/transit/city/${city.id}`}
      onMouseEnter={() => preloadCityData(city.id)}
      onTouchStart={() => preloadCityData(city.id)}
      onFocus={() => preloadCityData(city.id)}
      className={`${base} is-ready no-underline hover:-translate-y-0.5 hover:border-[var(--border-hover)]`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--gold)] transition-colors duration-200 group-hover:bg-[var(--gold)] group-hover:text-[var(--surface)]">
          <GovernorateIcon cityId={city.id} />
        </span>
        <div className="flex flex-col items-start">
          <h3 className="text-lg font-bold text-[var(--text)] sm:text-xl">{city.nameAr}</h3>
          <p className="text-xs text-[var(--muted)]">{city.nameEn}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--gold)]">
          {city.routeCount} خطاً
        </span>
        <svg
          className="text-[var(--muted)] transition-all duration-200 group-hover:-translate-x-1 group-hover:text-[var(--gold)]"
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </div>
    </Link>
  )
}
