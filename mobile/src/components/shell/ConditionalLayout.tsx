import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import UnblockSyriaNotification from '@/components/UnblockSyriaNotification';

import { Navbar } from './Navbar';

export function ConditionalLayout({ children }: PropsWithChildren) {
  return (
    <View style={{ flex: 1 }}>
      <Navbar />
      {children}
      <UnblockSyriaNotification />
    </View>
  );
}

/*
PORT STATUS
  source:     resources/js/Components/ConditionalLayout.tsx (16 lines)
  confidence: high
  todos:      0
  notes:      The native shell stays visible while full-screen maps opt out locally.
*/
