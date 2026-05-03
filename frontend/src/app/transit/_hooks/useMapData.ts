import { useEffect, useState } from 'react'
import type { FeatureCollection, RouteProperties, StopProperties } from '../_types'

const cache = new Map<string, { routes: FeatureCollection<RouteProperties>; stops: FeatureCollection<StopProperties> }>()
const inflight = new Set<string>()

export function preloadCityData(cityId: string): void {
  if (cache.has(cityId) || inflight.has(cityId)) return
  inflight.add(cityId)
  Promise.all([
    fetch(`/data/${cityId}/routes.geojson`).then((r) => r.json() as Promise<FeatureCollection<RouteProperties>>),
    fetch(`/data/${cityId}/stops.geojson`).then((r) => r.json() as Promise<FeatureCollection<StopProperties>>),
  ])
    .then(([routes, stops]) => {
      cache.set(cityId, { routes, stops })
    })
    .catch(() => {})
    .finally(() => inflight.delete(cityId))
}

export function useMapData(cityId: string | undefined) {
  const [data, setData] = useState<{
    routes: FeatureCollection<RouteProperties>
    stops: FeatureCollection<StopProperties>
  } | null>(() => (cityId ? (cache.get(cityId) ?? null) : null))
  const [loading, setLoading] = useState(() => !!cityId && !cache.has(cityId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cityId) return

    if (cache.has(cityId)) {
      setData(cache.get(cityId)!)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/data/${cityId}/routes.geojson`).then((r) => {
        if (!r.ok) throw new Error('routes fetch failed')
        return r.json() as Promise<FeatureCollection<RouteProperties>>
      }),
      fetch(`/data/${cityId}/stops.geojson`).then((r) => {
        if (!r.ok) throw new Error('stops fetch failed')
        return r.json() as Promise<FeatureCollection<StopProperties>>
      }),
    ])
      .then(([routes, stops]) => {
        const payload = { routes, stops }
        cache.set(cityId, payload)
        setData(payload)
        setLoading(false)
      })
      .catch((err) => {
        setError(err?.message || 'Unknown error')
        setLoading(false)
      })
  }, [cityId])

  return { data, loading, error }
}
