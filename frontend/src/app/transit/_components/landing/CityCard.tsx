'use client'

import Link from 'next/link'
import type { City } from '../../_types'
import { usePreloadCity } from '../../_hooks/useMapData'

interface CityCardProps {
  city: City
  index: number
}

export default function CityCard({ city, index }: CityCardProps) {
  const isComingSoon = city.status === 'coming_soon'
  const preloadCityData = usePreloadCity()

  const cardClasses = `city-card relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] transition-colors duration-200 hover:border-[var(--border-hover)] focus-within:border-[var(--border-hover)] sm:rounded-xl ${isComingSoon ? 'opacity-40' : ''}`

  return (
    <div
      className={cardClasses}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {isComingSoon ? (
        <div className="flex flex-row items-center justify-between gap-3 p-3 sm:flex-col sm:items-start sm:gap-2 sm:p-5">
          <div className="flex flex-col items-start">
            <h3 className="text-lg font-bold text-[var(--text)] sm:text-2xl">{city.nameAr}</h3>
            <p className="text-xs text-[var(--muted)] sm:text-sm">{city.nameEn}</p>
          </div>
          <span className="inline-block rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted)] sm:mt-2 sm:px-3 sm:py-1">
            قريباً
          </span>
        </div>
      ) : (
        <Link
          href={`/transit/city/${city.id}`}
          onMouseEnter={() => preloadCityData(city.id)}
          onTouchStart={() => preloadCityData(city.id)}
          onFocus={() => preloadCityData(city.id)}
          className="flex flex-row items-center justify-between gap-3 p-3 no-underline sm:flex-col sm:items-start sm:gap-2 sm:p-5"
        >
          <div className="flex flex-col items-start">
            <h3 className="text-lg font-bold text-[var(--text)] sm:text-2xl">{city.nameAr}</h3>
            <p className="text-xs text-[var(--muted)] sm:text-sm">{city.nameEn}</p>
          </div>
          <span className="inline-block rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--gold)] sm:mt-2 sm:px-3 sm:py-1">
            {city.routeCount} خطاً
          </span>
        </Link>
      )}
    </div>
  )
}
