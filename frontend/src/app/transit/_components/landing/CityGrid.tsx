import citiesData from '../../_data/cities.json'
import CityCard from './CityCard'
import type { City } from '../../_types'

const cities = (citiesData as City[]).filter((c) => c.status === 'active')

export default function CityGrid() {
  return (
    <section className="px-4 pb-8 pt-4 sm:pb-12 sm:pt-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-3 text-base font-semibold text-[var(--text)] sm:mb-4 sm:text-lg">المدن المتاحة</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {cities.map((city, i) => (
            <CityCard key={city.id} city={city} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
