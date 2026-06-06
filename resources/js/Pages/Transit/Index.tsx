import React from 'react'
import Header from './_components/layout/Header'
import Hero from './_components/landing/Hero'
import CityGrid from './_components/landing/CityGrid'
import TransitLayout from './layout'

export default function TransitLandingPage() {
  return (
    <TransitLayout>
      <div className="flex min-h-svh flex-col bg-[var(--bg)]">
        <Header />
        <main className="flex-1">
          <Hero />
          <CityGrid />
        </main>
        <footer className="border-t border-[var(--border)] px-4 py-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium tracking-wide text-[var(--gold)]">SYRIAN.ZONE</span>
              <span className="text-xs text-[var(--muted)]">/</span>
              <span className="font-bold text-[var(--text)]">ترانزيت</span>
            </div>
            <p className="text-xs text-[var(--muted)]">مشروع مجتمعي مفتوح المصدر</p>
          </div>
        </footer>
      </div>
    </TransitLayout>
  )
}
