import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { TransitThemeProvider } from './_components/TransitThemeContext';
import { TransitHeader } from './_components/layout/Header';
import { QueryProvider } from './_providers/QueryProvider';

export default function TransitLayout({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <TransitThemeProvider>
        <View style={styles.root}>
          <TransitHeader />
          <View style={styles.content}>{children}</View>
        </View>
      </TransitThemeProvider>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
});

/*
PORT STATUS
  source:     resources/js/Pages/Transit/layout.tsx (43 lines)
  confidence: high
  todos:      0
  notes:      Native providers and the Transit heritage header wrap every routed Transit screen.
*/
