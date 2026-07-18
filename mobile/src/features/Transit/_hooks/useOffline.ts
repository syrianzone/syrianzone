import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useOffline(): boolean {
  const [offline, setOffline] = useState(false);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOffline(!state.isConnected || state.isInternetReachable === false);
      }),
    [],
  );
  return offline;
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_hooks/useOffline.ts (22 lines)
  confidence: high
  todos:      0
  notes:      NetInfo replaces browser online and offline events.
*/
