import { useQuery } from '@tanstack/react-query';
import type { WidgetDefinition } from './types';

// One helper so no widget writes query options by hand. The provider is already
// mounted globally in app.tsx.
//
// refetchIntervalInBackground stays false deliberately: several polling widgets
// across many open tabs is real load for no benefit while hidden.
export function useWidgetQuery<T>(def: WidgetDefinition<any>, key: unknown, fn: () => Promise<T>) {
  return useQuery({
    queryKey: ['board-widget', def.id, key],
    queryFn: fn,
    staleTime: def.refresh.staleMs,
    refetchInterval: def.refresh.intervalMs ?? false,
    refetchIntervalInBackground: false,
    retry: 1,
  });
}
