import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

function subscribe(callback: () => void): () => void {
  const listener = AppState.addEventListener('change', callback);
  return () => listener.remove();
}
const foreground = (): boolean => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
export function useScreenActive(): boolean {
  const focused = useIsFocused();
  const active = useSyncExternalStore(subscribe, foreground, () => true);
  return focused && active;
}
