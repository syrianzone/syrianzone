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
    'latakia': 'lattakia',
    'lattakia': 'lattakia',
    'tartus': 'tartus',
    'tartous': 'tartus',
    'daraa': 'dar`a',
    'suwayda': 'as suwayda',
    'sweida': 'as suwayda',
    'quneitra': 'quneitra',
    'deir-ez-zor': 'dayr az zawr',
    'deir-ezzor': 'dayr az zawr',
    'raqqa': 'ar raqqah',
    'hasakah': 'al Ḥasakah',
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

import { cn } from '@/lib/utils'

export default function CityCard({ city, index }: CityCardProps) {
  const isReady = city.status === 'active' && city.routeCount > 0
  const preloadCityData = usePreloadCity()

  const base = cn(
    'city-card group relative flex flex-col items-center justify-center text-center gap-3 rounded-xl border border-border bg-card p-5 transition-all duration-200',
    isReady ? 'hover:-translate-y-0.5 hover:border-primary/50 cursor-pointer' : 'opacity-55 cursor-not-allowed'
  )

  const cardContent = (
    <>
      <span className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-primary transition-colors duration-200",
        isReady && "group-hover:bg-primary group-hover:text-primary-foreground"
      )}>
        <GovernorateIcon cityId={city.id} />
      </span>
      <div className="flex flex-col items-center gap-1.5">
        <h3 className="text-sm font-bold text-foreground leading-none">{city.nameAr}</h3>
        <span className="text-xs text-muted-foreground font-medium">
          {city.routeCount > 0 ? `${city.routeCount} خط` : 'قريباً'}
        </span>
      </div>
    </>
  )

  if (!isReady) {
    return (
      <div
        className={base}
        style={{ animationDelay: `${index * 40}ms` }}
        aria-disabled="true"
      >
        {cardContent}
      </div>
    )
  }

  return (
    <Link
      href={`/transit/city/${city.id}`}
      onMouseEnter={() => preloadCityData(city.id)}
      onTouchStart={() => preloadCityData(city.id)}
      onFocus={() => preloadCityData(city.id)}
      className={cn(base, "no-underline")}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {cardContent}
    </Link>
  )
}
