import Header from './_components/layout/Header'
import CityGrid from './_components/landing/CityGrid'

export default function TransitLandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-[var(--bg)]">
      <Header />
      <main className="flex-1">
        <CityGrid />
      </main>
      <footer className="border-t border-[var(--border)] px-4 py-6 text-center text-xs text-[var(--muted)]">
        Syrian Zone — مشروع مجتمعي مفتوح المصدر
      </footer>
    </div>
  )
}
