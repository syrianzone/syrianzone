import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';

let configured = false;

export function configureQueryManagers(): () => void {
  if (configured) {
    return () => undefined;
  }
  configured = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    }),
  );

  const subscription = AppState.addEventListener(
    'change',
    (status: AppStateStatus) => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    },
  );

  return () => {
    subscription.remove();
    configured = false;
  };
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'offlineFirst',
        retry: 2,
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
      },
      mutations: {
        networkMode: 'online',
        retry: 0,
      },
    },
  });
}
