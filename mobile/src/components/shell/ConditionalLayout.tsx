import { usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import UnblockSyriaNotification from '@/components/UnblockSyriaNotification';

import { Navbar } from './Navbar';

export function ConditionalLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const showNavbar = pathname !== '/';
  const showUnblockNotice = !pathname.startsWith('/transit');

  return (
    <View style={{ flex: 1 }}>
      {showNavbar ? <Navbar /> : null}
      {children}
      {showUnblockNotice ? <UnblockSyriaNotification /> : null}
    </View>
  );
}

/*
PORT STATUS
  source:     resources/js/Components/ConditionalLayout.tsx (26 lines)
  confidence: high
  todos:      0
  notes:      Native routing preserves the source start-page and Transit shell visibility rules.
*/
