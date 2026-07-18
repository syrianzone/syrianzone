import type { PropsWithChildren } from 'react';

export function QueryProvider({ children }: PropsWithChildren) {
  return children;
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_providers/QueryProvider.tsx (24 lines)
  confidence: high
  todos:      0
  notes:      Transit reuses the application-wide offline-first QueryClient.
*/
