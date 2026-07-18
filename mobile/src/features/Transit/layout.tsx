import type { PropsWithChildren } from 'react';

import { TransitThemeProvider } from './_components/TransitThemeContext';
import { QueryProvider } from './_providers/QueryProvider';

export default function TransitLayout({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <TransitThemeProvider>{children}</TransitThemeProvider>
    </QueryProvider>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/layout.tsx (27 lines)
  confidence: high
  todos:      0
  notes:      Native providers replace the browser layout and CSS scope.
*/
