import React from 'react'
import citiesData from '../../_data/cities.json'
import Header from '../../_components/layout/Header'
import RoutesList from './_components/RoutesList'
import type { City } from '../../_types'
import TransitLayout from '../../layout'

const cities = citiesData as City[]

interface CityRoutesPageProps {
  id: string
}

export default function CityRoutesPage({ id }: CityRoutesPageProps) {
  const city = cities.find((c) => c.id === id)

  if (!city || !city.bounds) {
    return (
      <TransitLayout>
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
      <div className="flex min-h-svh flex-col bg-[var(--bg)]">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[var(--text)]">{city.nameAr}</h2>
            <p className="text-sm text-[var(--muted)]">{city.routeCount} خط سيرفيس</p>
          </div>
          <RoutesList cityId={id} />
        </main>
      </div>
    </TransitLayout>
  )
}
