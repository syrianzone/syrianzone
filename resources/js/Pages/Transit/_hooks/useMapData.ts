import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { RouteProperties } from '../_types'
import type { Draft } from '../_types/admin'
import { apiErrorMessage } from '@/Lib/api'
import { transitApi, type MapDataResponse } from '../_lib/api'

export function useMapData(cityId: string | undefined) {
  const { data, isLoading, error } = useQuery<MapDataResponse>({
    queryKey: ['mapData', cityId],
    queryFn: ({ signal }) => transitApi.mapData(cityId ?? '', signal),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    data: data ?? null,
    loading: isLoading,
    error: error ? apiErrorMessage(error, 'تعذّر تحميل بيانات المدينة') : null,
  }
}

/**
 * `initialData` is the list the server sent with the page, when it sent one:
 * the sidebar then renders the routes on the server and on first paint instead
 * of an empty state.
 */
export function useRoutes(cityId: string, initialData?: RouteProperties[]) {
  return useQuery<RouteProperties[]>({
    queryKey: ['routes', cityId],
    queryFn: ({ signal }) => transitApi.routes(cityId, signal),
    enabled: !!cityId,
    ...(initialData ? { initialData } : {}),
    staleTime: 5 * 60 * 1000,
  })
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
    queryFn: () => transitApi.routeDrafts(),
    staleTime: 30_000,
  })
}

export function usePreloadCity() {
  const queryClient = useQueryClient()
  return (cityId: string) => {
    queryClient.prefetchQuery({
      queryKey: ['mapData', cityId],
      queryFn: ({ signal }) => transitApi.mapData(cityId, signal),
      staleTime: 5 * 60 * 1000,
    })
    queryClient.prefetchQuery({
      queryKey: ['routes', cityId],
      queryFn: ({ signal }) => transitApi.routes(cityId, signal),
      staleTime: 5 * 60 * 1000,
    })
  }
}
