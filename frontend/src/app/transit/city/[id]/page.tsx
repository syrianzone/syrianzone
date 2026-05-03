import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import type { Metadata } from 'next'
import citiesData from '../../_data/cities.json'
import Header from '../../_components/layout/Header'
import { getRouteColor } from '../../_lib/mapColors'
import type { City, FeatureCollection, RouteProperties } from '../../_types'

const cities = citiesData as City[]

export function generateStaticParams() {
  return cities.filter((c) => c.status === 'active').map((c) => ({ id: c.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const city = cities.find((c) => c.id === id)
  return { title: city ? `${city.nameAr} — ترانزيت` : 'ترانزيت' }
}

function formatPrice(p: number | undefined) {
  return `${(p ?? 25).toLocaleString('ar-SY')} ل.س`
}

function formatOldPrice(p: number | undefined) {
  return `${(p ?? 2500).toLocaleString('ar-SY')} ل.س قديم`
}

export default async function CityRoutesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const city = cities.find((c) => c.id === id)

  if (!city || !city.bounds) {
    return (
      <div className="flex min-h-svh flex-col bg-[var(--bg)]">
        <Header />
        <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
          المدينة غير موجودة
        </div>
      </div>
    )
  }

  let routes: RouteProperties[] = []
  try {
    const file = fs.readFileSync(
      path.join(process.cwd(), 'public', 'data', id, 'routes.geojson'),
      'utf-8',
    )
    routes = (JSON.parse(file) as FeatureCollection<RouteProperties>).features.map(
      (f) => f.properties,
    )
  } catch {}

  return (
    <div className="flex min-h-svh flex-col bg-[var(--bg)]">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[var(--text)]">{city.nameAr}</h2>
          <p className="text-sm text-[var(--muted)]">{city.routeCount} خط سيرفيس</p>
        </div>

        {routes.length === 0 && (
          <div className="py-12 text-center text-[var(--muted)]">لا توجد خطوط متاحة</div>
        )}

        <div className="space-y-3">
          {routes.map((route) => (
            <Link
              key={route.id}
              href={`/transit/city/${city.id}/route/${route.id}`}
              className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--border-hover)]"
            >
              <span
                className="h-10 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: getRouteColor(route.colorIndex) }}
              />
              <div className="flex-1">
                <h3 className="text-base font-semibold text-[var(--text)]">{route.nameAr}</h3>
                <p className="text-xs text-[var(--muted)]">{route.nameEn}</p>
              </div>
              <div className="text-end">
                <span className="block text-sm font-bold text-[var(--gold)]">
                  {formatPrice(route.priceNew)}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {formatOldPrice(route.priceOld)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link
            href={`/transit/city/${city.id}/map`}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-5 py-2.5 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hover)]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="1 6 1 22 8 18 16 22 21 18 21 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            عرض الكل على الخريطة
          </Link>
        </div>
      </main>
    </div>
  )
}
