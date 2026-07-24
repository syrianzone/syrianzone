import React from 'react'
import { Link, Head } from '@inertiajs/react'
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
        <Head>
          <title>المدينة غير موجودة - ترانزيت</title>
        </Head>
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
      <Head>
        <title>{route ? `${route.nameAr} (${city.nameAr}) | ترانزيت` : 'الخط غير موجود - ترانزيت'}</title>
        <meta name="description" content={route ? `تعرف على مسار، ومواقف، وسعر خط سيرفيس ${route.nameAr} في مدينة ${city.nameAr} مع خريطة تفاعلية للمسار.` : 'تفاصيل الخط المطلوبة غير متوفرة.'} />
      </Head>
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
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Link
                      href={`/transit/city/${city.id}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:text-primary transition-colors shrink-0 mt-0.5"
                      title="العودة للخطوط"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white mt-0.5"
                      style={{ backgroundColor: getRouteColor(route.colorIndex) }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bus">
                        <rect width="16" height="16" x="4" y="3" rx="2" />
                        <path d="M4 11h16" />
                        <path d="M8 15h.01" />
                        <path d="M16 15h.01" />
                        <path d="M6 19v2" />
                        <path d="M18 19v2" />
                      </svg>
                    </span>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[var(--text)]">{route.nameAr}</h2>
                    </div>
                  </div>
                  <Link
                    href={`/transit/city/${city.id}/map?route=${route.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/95 shadow-sm shrink-0"
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
                      <polygon points="1 6 1 22 8 18 16 22 21 18 21 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" />
                      <line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                    <span>فتح الخريطة</span>
                  </Link>
                </div>
              </div>

              <div className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-4" dir="rtl">
                  {/* Description / English Name */}
                  {route.nameEn && (
                    <div className="col-span-2 border-b border-[var(--border)] pb-3">
                      <p className="text-xs text-[var(--muted)] mb-0.5">تفاصيل الخط</p>
                      <p className="text-sm font-semibold text-[var(--text)]">{route.nameEn}</p>
                    </div>
                  )}
                  
                  {/* Price */}
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">سعر الركوب</p>
                    <p className="text-base sm:text-lg font-bold text-[var(--gold)]">{formatPrice(route.priceNew)}</p>
                  </div>
                  
                  {/* Number of stops */}
                  <div>
                    <p className="text-xs text-[var(--muted)] mb-0.5">عدد المواقف</p>
                    <p className="text-base sm:text-lg font-bold text-[var(--text)]">{stops.length} موقف</p>
                  </div>
                  
                  {/* Old Price */}
                  {route.priceOld > 0 && (
                    <div className="col-span-2 border-t border-[var(--border)] pt-3">
                      <p className="text-xs text-[var(--muted)] mb-0.5">السعر بالليرة القديمة</p>
                      <p className="text-xs sm:text-sm text-[var(--muted)]">{formatOldPrice(route.priceOld)}</p>
                    </div>
                  )}
                </div>
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
                    <a
                      key={stop.properties.id}
                      href={`https://www.google.com/maps/dir/?api=1&destination=${stop.coordinates[1]},${stop.coordinates[0]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors hover:border-primary/30 hover:shadow-sm"
                      dir="rtl"
                    >
                      {/* Right side: Stop Number & Stop Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-medium text-[var(--muted)]">
                          {index + 1}
                        </span>
                        <div className="min-w-0 text-right">
                          <p className="text-sm font-medium text-[var(--text)] leading-snug break-words">
                            {stop.properties.nameAr}
                          </p>
                          {stop.properties.nameEn && (
                            <p className="text-xs text-[var(--muted)] leading-snug break-words">{stop.properties.nameEn}</p>
                          )}
                        </div>
                      </div>

                      {/* Left side: Directions link */}
                      <span className="flex items-center gap-1 text-xs font-semibold text-[var(--gold)] shrink-0 hover:underline">
                        <span className="hidden sm:inline">عرض في تطبيق الخرائط</span>
                        <span className="inline sm:hidden">الخريطة</span>
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                        </svg>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </TransitLayout>
  )
}
