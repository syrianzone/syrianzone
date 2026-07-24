import type { PropsWithChildren } from 'react';

export function QueryProvider({ children }: PropsWithChildren) {
  return children;
}

/*
PORT STATUS
  source:     resources/js/Providers/QueryProvider.tsx (24 lines)
  confidence: high
  todos:      0
  notes:      The reachable no-op wrapper preserves Transit composition without creating a second QueryClient cache.
*/
