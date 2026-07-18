import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getCityRoutes, getMapData } from '../api';

export function useMapData(cityId: string | undefined) {
  const query = useQuery({
    enabled: Boolean(cityId),
    queryFn: () => getMapData(cityId!),
    queryKey: ['transit-map-data', cityId],
    staleTime: 5 * 60 * 1000,
  });
  return {
    data: query.data ?? null,
    error: query.error instanceof Error ? query.error.message : null,
    loading: query.isLoading,
    refetch: query.refetch,
  };
}

export function useRoutes(cityId: string) {
  return useQuery({
    queryFn: () => getCityRoutes(cityId),
    queryKey: ['transit-routes', cityId],
    staleTime: 5 * 60 * 1000,
  });
}

export function usePreloadCity() {
  const client = useQueryClient();
  return (cityId: string) => {
    void client.prefetchQuery({
      queryFn: () => getMapData(cityId),
      queryKey: ['transit-map-data', cityId],
      staleTime: 5 * 60 * 1000,
    });
    void client.prefetchQuery({
      queryFn: () => getCityRoutes(cityId),
      queryKey: ['transit-routes', cityId],
      staleTime: 5 * 60 * 1000,
    });
  };
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_hooks/useMapData.ts (83 lines)
  confidence: high
  todos:      0
  notes:      Typed native API calls retain caching, errors, and city prefetch.
*/
