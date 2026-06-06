import citiesData from '../../_data/cities.json'
import type { City } from '../../_types'

const cities = (citiesData as City[]).filter((c) => c.status === 'active')
const readyCities = cities.filter((c) => c.routeCount > 0).length
const totalRoutes = cities.reduce((sum, c) => sum + (c.routeCount || 0), 0)

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className="text-2xl font-bold text-[var(--text)] sm:text-3xl"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {value.toLocaleString('ar-SY')}
      </span>
      <span className="text-sm text-[var(--muted)]">{label}</span>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="transit-hero relative overflow-hidden border-b border-[var(--border)]">
      <div className="transit-hero-glow" aria-hidden="true" />
      <div className="transit-hero-lines" aria-hidden="true" />

      <div className="relative mx-auto max-w-3xl px-4 py-14 sm:py-20">
        <p
          className="transit-hero-eyebrow mb-4 text-xs uppercase tracking-[0.35em] text-[var(--gold)]"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          Syria · Transit
        </p>

        <h1 className="transit-hero-title text-4xl font-extrabold leading-[1.15] text-[var(--text)] sm:text-6xl">
          دليل خطوط
          <br />
          السرافيس
        </h1>

        <p className="transit-hero-sub mt-5 max-w-xl text-base leading-relaxed text-[var(--muted)] sm:text-lg">
          خرائط ومسارات النقل الداخلي في المدن السورية — يجمعها المجتمع ويحدّثها،
          ومتاحة للجميع مجاناً.
        </p>

        <div className="transit-hero-stats mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Stat value={readyCities} label="مدينة جاهزة" />
          <span className="h-9 w-px bg-[var(--border)]" aria-hidden="true" />
          <Stat value={totalRoutes} label="خط سيرفيس" />
        </div>
      </div>
    </section>
  )
}
