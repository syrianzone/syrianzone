import { useEffect, useSyncExternalStore } from 'react';
import * as Font from 'expo-font';

let state = { ready: false, error: null as string | null };
let pending: Promise<void> | null = null;
const subscribers = new Set<() => void>();
function publish(ready: boolean, error: string | null): void { state = { ready, error }; subscribers.forEach(callback => callback()); }
export function loadQuranFont(): Promise<void> {
  if (state.ready) return Promise.resolve();
  if (!pending) {
    // Original unmodified asset. Its embedded license accompanies the native app.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pending = Font.loadAsync('QuranHafs', require('../../../../public/fonts/quran-hafs.woff2')).then(() => publish(true, null))
      .catch((reason: unknown) => { pending = null; publish(false, 'تعذر تحميل خط المصحف. أعد المحاولة.'); throw reason; });
  }
  const operation = pending;
  return operation ?? Promise.reject(new Error('تعذر تحميل خط المصحف.'));
}
export function useQuranFont(): { ready: boolean; error: string | null; retry(): void } {
  useEffect(() => { void loadQuranFont().catch(() => undefined); }, []);
  const snapshot = useSyncExternalStore(callback => { subscribers.add(callback); return () => { subscribers.delete(callback); }; }, () => state, () => state);
  return { ...snapshot, retry: () => { void loadQuranFont().catch(() => undefined); } };
}
