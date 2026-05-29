import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeatureCollection, RouteProperties, StopProperties } from '../_types'

const API = () => process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'

// ─── Map data (routes + stops GeoJSON) ───────────────────────────────────────

interface MapDataResponse {
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
}

const fetchMapData = async (cityId: string): Promise<MapDataResponse> => {
  const res = await fetch(`${API()}/v1/cities/${cityId}/map-data`)
  if (!res.ok) throw new Error('Failed to fetch map data')
  return res.json()
}

export function useMapData(cityId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['mapData', cityId],
    queryFn: () => fetchMapData(cityId!),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: data || null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  }
}

// ─── City routes list ─────────────────────────────────────────────────────────

const fetchRoutes = async (cityId: string): Promise<RouteProperties[]> => {
  const res = await fetch(`${API()}/v1/cities/${cityId}/routes`)
  if (!res.ok) throw new Error('Failed to fetch routes')
  return res.json()
}

export function useRoutes(cityId: string) {
  return useQuery({
    queryKey: ['routes', cityId],
    queryFn: () => fetchRoutes(cityId),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Admin drafts ─────────────────────────────────────────────────────────────

export function useAdminDrafts(token: string | null) {
  return useQuery({
    queryKey: ['admin-drafts', token],
    queryFn: () =>
      fetch(`${API()}/v1/admin/route-drafts`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => {
        if (r.status === 401) throw new Error('UNAUTHORIZED')
        if (!r.ok) throw new Error('Failed to fetch drafts')
        return r.json()
      }),
    enabled: !!token,
    staleTime: 30_000,
  })
}

// ─── Prefetch helpers (called on hover) ──────────────────────────────────────

export function usePreloadCity() {
  const queryClient = useQueryClient()
  return (cityId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['mapData', cityId],
      queryFn: () => fetchMapData(cityId),
      staleTime: 5 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: ['routes', cityId],
      queryFn: () => fetchRoutes(cityId),
      staleTime: 5 * 60 * 1000,
    })
  }
}
