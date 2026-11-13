import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FeatureCollection, RouteProperties, StopProperties } from '../_types'
import type { Draft } from '../_types/admin'

const API = () => '/api'

// ─── Map data (routes + stops GeoJSON) ───────────────────────────────────────

interface MapDataResponse {
  routes: FeatureCollection<RouteProperties>
  stops: FeatureCollection<StopProperties>
}

const fetchMapData = async (cityId: string): Promise<MapDataResponse> => {
  const res = await fetch(`${API()}/v1/cities/${cityId}/map-data`)
  if (!res.ok) throw new Error('Failed to fetch map data')
  return res.json() as Promise<MapDataResponse>
}

export function useMapData(cityId: string | undefined) {
  const { data, isLoading, error } = useQuery<MapDataResponse>({
    queryKey: ['mapData', cityId],
    queryFn: () => fetchMapData(cityId ?? ''),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error instanceof Error ? error.message : null,
  }
}

// ─── City routes list ─────────────────────────────────────────────────────────

const fetchRoutes = async (cityId: string): Promise<RouteProperties[]> => {
  const res = await fetch(`${API()}/v1/cities/${cityId}/routes`)
  if (!res.ok) throw new Error('Failed to fetch routes')
  return res.json() as Promise<RouteProperties[]>
}

/**
 * `initialData` is the list the server sent with the page, when it sent one:
 * the sidebar then renders the routes on the server and on first paint instead
 * of an empty state.
 */
export function useRoutes(cityId: string, initialData?: RouteProperties[]) {
  return useQuery<RouteProperties[]>({
    queryKey: ['routes', cityId],
    queryFn: () => fetchRoutes(cityId),
    enabled: !!cityId,
    ...(initialData ? { initialData } : {}),
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Admin drafts ─────────────────────────────────────────────────────────────

const fetchAdminDrafts = async (): Promise<Draft[]> => {
  const response = await fetch(`${API()}/v1/admin/route-drafts`, {
    credentials: 'include',
  })
  if (response.status === 401) throw new Error('UNAUTHORIZED')
  if (!response.ok) throw new Error('Failed to fetch drafts')
  return response.json() as Promise<Draft[]>
}

/**
 * Pending route drafts for the moderation queue.
 *
 * `enabled` is passed in rather than hardcoded to true: the endpoint is tagged
 * transit_admin:transit.review_drafts, so a transit.edit_routes-only operator
 * must not fire a request that is guaranteed to 403 on mount.
 */
export function useAdminDrafts(enabled = true) {
  return useQuery<Draft[]>({
    queryKey: ['admin-drafts'],
    enabled,
    queryFn: fetchAdminDrafts,
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
