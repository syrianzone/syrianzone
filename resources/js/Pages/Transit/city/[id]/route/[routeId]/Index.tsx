import React from 'react'
import { Link } from '@inertiajs/react'
import Header from '../../../../_components/layout/Header'
import DirectionsButton from '../../../../_components/DirectionsButton'
import { getRouteColor } from '../../../../_lib/mapColors'
import type { City, RouteProperties, StopProperties } from '../../../../_types'
import TransitLayout from '../../../../layout'

interface RouteDetailPageProps {
  id: string
  city: City
  route: RouteProperties | null
  stops: { properties: StopProperties; coordinates: [number, number] }[]
}

function formatPrice(p: number | undefined) {
  return `${(p ?? 25).toLocaleString('ar-SY')} ل.س`
}

function formatOldPrice(p: number | undefined) {
  return `${(p ?? 2500).toLocaleString('ar-SY')} ليرة سورية قديمة`
}

export default function RouteDetailPage({ id, city, route, stops = [] }: RouteDetailPageProps) {
  if (!city || !city.bounds) {
    return (
      <TransitLayout>
        <div className="flex min-h-svh flex-col bg-[var(--bg)]">
          <Header />
          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 text-center">
            <p className="mb-4 text-lg text-[var(--text)]">المدينة غير موجودة</p>
            <Link
              href="/transit"
              className="rounded-lg bg-[var(--gold)] px-5 py-2 text-sm font-bold text-[var(--bg)]"
            >
              العودة للرئيسية
            </Link>
          </main>
        </div>
      </TransitLayout>
    )
  }

  return (
    <TransitLayout>
      <div className="flex min-h-svh flex-col bg-[var(--bg)]">
        <Header />

        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          {!route && (
            <div className="py-12 text-center">
              <p className="mb-4 text-lg text-[var(--text)]">الخط غير موجود</p>
              <Link
                href={`/transit/city/${city.id}`}
                className="rounded-lg bg-[var(--gold)] px-5 py-2 text-sm font-bold text-[var(--bg)]"
              >
                العودة للخطوط
              </Link>
            </div>
          )}

          {route && (
            <>
              <div className="mb-6">
                <Link
                  href={`/transit/city/${city.id}`}
                  className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--gold)]"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  العودة للخطوط
                </Link>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-[var(--text)]">{route.nameAr}</h2>
                    <p className="text-sm text-[var(--muted)]">{route.nameEn}</p>
                  </div>
                  <span
                    className="inline-block rounded-full px-3 py-1 text-xs font-medium text-[var(--bg)]"
                    style={{ backgroundColor: getRouteColor(route.colorIndex) }}
                  >
                    سيرفيس
                  </span>
                </div>
              </div>

              <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="mb-1 text-xs text-[var(--muted)]">سعر الركوب</p>
                <p className="text-xl font-bold text-[var(--gold)]">{formatPrice(route.priceNew)}</p>
                <p className="text-xs text-[var(--muted)]">{formatOldPrice(route.priceOld)}</p>
              </div>

              <div className="mb-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[var(--muted)]">المواقف على الخط</h3>
                  <span className="text-xs text-[var(--muted)]">{stops.length} موقف</span>
                </div>
                {stops.length === 0 && (
                  <p className="py-4 text-center text-sm text-[var(--muted)]">
                    لا توجد مواقف مسجلة لهذا الخط
                  </p>
                )}
                <div className="space-y-2">
                  {stops.map((stop, index) => (
                    <div
                      key={stop.properties.id}
                      className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-medium text-[var(--muted)]">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--text)]">
                          {stop.properties.nameAr}
                        </p>
                        {stop.properties.nameEn && (
                          <p className="text-xs text-[var(--muted)]">{stop.properties.nameEn}</p>
                        )}
                      </div>
                      <DirectionsButton lat={stop.coordinates[1]} lng={stop.coordinates[0]} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="sticky bottom-6">
                <Link
                  href={`/transit/city/${city.id}/map?route=${route.id}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] py-3.5 text-base font-bold text-[var(--bg)] shadow-lg transition-opacity hover:opacity-90"
                >
                  <svg
                    width="20"
                    height="20"
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
                  فتح الخريطة
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    </TransitLayout>
  )
}
