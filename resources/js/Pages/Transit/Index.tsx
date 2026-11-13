import Hero from './_components/landing/Hero'
import CityGrid from './_components/landing/CityGrid'

import MainLayout from '@/Layouts/MainLayout'

import type { TransitCity } from '@/Domain/transit/types'

export default function TransitLandingPage({ cities = [] }: { cities?: TransitCity[] }) {
  return (
    <MainLayout>
      
      <div className="min-h-svh bg-background">
        <Hero cities={cities} />
        <CityGrid cities={cities} />
        <footer className="border-t border-border px-4 py-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium tracking-wide text-primary">SYRIAN.ZONE</span>
              <span className="text-xs text-muted-foreground">/</span>
              <span className="font-bold text-foreground">ترانزيت</span>
            </div>
            <p className="text-xs text-muted-foreground">مشروع مجتمعي مفتوح المصدر</p>
          </div>
        </footer>
      </div>
    </MainLayout>
  )
}
