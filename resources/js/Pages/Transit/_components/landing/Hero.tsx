import citiesData from '../../_data/cities.json'
import type { City } from '../../_types'

interface HeroProps {
  cities?: City[]
}

export default function Hero({ cities: propCities }: HeroProps) {
  const cities = (propCities && propCities.length > 0 ? propCities : (citiesData as City[])).filter((c) => c.status === 'active')
  const readyCities = cities.filter((c) => c.routeCount > 0).length
  const totalRoutes = cities.reduce((sum, c) => sum + (c.routeCount || 0), 0)

  return (
    <section className="bg-card border-b border-border py-12 text-center">
      <div className="mx-auto px-4 max-w-4xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">ترانزيت سوريا</h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 leading-relaxed">
          دليل وخرائط تفاعلية لشبكات وخطوط المواصلات العامة والسرافيس في المدن السورية — يجمعها المجتمع ويحدّثها، ومتاحة للجميع مجاناً.
        </p>
        <div className="flex justify-center items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-lg sm:text-xl" style={{ fontFamily: 'var(--font-mono)' }}>
              {readyCities.toLocaleString('ar-SY')}
            </span>
            <span className="text-muted-foreground text-xs font-medium">مدن جاهزة</span>
          </div>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground text-lg sm:text-xl" style={{ fontFamily: 'var(--font-mono)' }}>
              {totalRoutes.toLocaleString('ar-SY')}
            </span>
            <span className="text-muted-foreground text-xs font-medium">خط سيرفيس</span>
          </div>
        </div>
      </div>
    </section>
  )
}
