import React from 'react'
import citiesData from '../../_data/cities.json'
import Header from '../../_components/layout/Header'
import RoutesList from './_components/RoutesList'
import type { City } from '../../_types'
import TransitLayout from '../../layout'
import { Head, Link } from '@inertiajs/react'

const cities = citiesData as City[]

interface CityRoutesPageProps {
  id: string
}

export default function CityRoutesPage({ id }: CityRoutesPageProps) {
  const city = cities.find((c) => c.id === id)

  if (!city || !city.bounds) {
    return (
      <TransitLayout>
        <Head>
          <title>المدينة غير موجودة - ترانزيت</title>
        </Head>
        <div className="flex min-h-svh flex-col bg-[var(--bg)]">
          <Header />
          <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
            المدينة غير موجودة
          </div>
        </div>
      </TransitLayout>
    )
  }

  return (
    <TransitLayout>
      <Head>
        <title>{`مواصلات وسرافيس ${city.nameAr} | ترانزيت`}</title>
        <meta name="description" content={`دليل وخريطة خطوط المواصلات العامة والسرافيس في مدينة ${city.nameAr} وتفاصيل مسار كل خط.`} />
      </Head>
      <div className="flex min-h-svh flex-col bg-[var(--bg)]">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <div className="mb-6 flex items-center justify-between gap-4" dir="rtl">
            <div className="flex items-center gap-3">
              <Link
                href="/transit"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:text-primary transition-colors shrink-0"
                title="العودة للرئيسية"
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
              <div>
                <h2 className="text-2xl font-bold text-[var(--text)]">{city.nameAr}</h2>
                <p className="text-sm text-[var(--muted)]">{city.routeCount} خط سيرفيس</p>
              </div>
            </div>
            <Link
              href={`/transit/city/${id}/map`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--border-hover)] shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="1 6 1 22 8 18 16 22 21 18 21 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              <span>عرض الكل على الخريطة</span>
            </Link>
          </div>
          <RoutesList cityId={id} />
        </main>
      </div>
    </TransitLayout>
  )
}
