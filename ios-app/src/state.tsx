import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';
import Storage from 'expo-sqlite/kv-store';
import type { Place } from './domain';
import { createLocalStore, type AppearanceMode, type LocalState } from './storage';

const localStore = createLocalStore(Storage);
interface AppState extends LocalState {
  ready: boolean;
  storageAvailable: boolean;
  busy: boolean;
  error: string | null;
  retry(): void;
  setAppearance(mode: AppearanceMode): Promise<void>;
  toggleSaved(place: Place): Promise<void>;
}
const StateContext = createContext<AppState | null>(null);

export function StateProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [state, setState] = useState<LocalState>({ appearance: null, saved: [] });
  const [ready, setReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const writing = useRef(false);
  useEffect(() => {
    let alive = true;
    localStore.load().then(value => {
      if (alive) { setState(value); setStorageAvailable(true); setReady(true); setError(null); }
    }).catch(() => {
      if (alive) { setStorageAvailable(false); setReady(true); setError('محفوظات الجهاز غير متاحة حالياً. يمكنك متابعة التصفح دونها.'); }
    });
    return () => { alive = false; };
  }, [revision]);

  async function persist(update: () => Promise<void>, next: Partial<LocalState>): Promise<void> {
    if (writing.current || !storageAvailable) return;
    writing.current = true;
    setBusy(true);
    try {
      await update();
      setState(previous => ({ ...previous, ...next }));
      setError(null);
    } catch {
      setError('تعذر حفظ التغيير على الجهاز. حاول مرة أخرى.');
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }

  return <StateContext.Provider value={{
    ...state, ready, storageAvailable, busy, error, retry: () => setRevision(value => value + 1),
    setAppearance: async (mode) => {
      await persist(() => localStore.setAppearance(mode), { appearance: mode });
    },
    toggleSaved: async (place) => {
      const saved = state.saved.some(item => item.id === place.id)
        ? state.saved.filter(item => item.id !== place.id) : [place, ...state.saved];
      await persist(() => localStore.setSaved(saved), { saved });
    },
  }}>{children}</StateContext.Provider>;
}

export function useAppState(): AppState {
  const value = useContext(StateContext);
  if (!value) throw new Error('StateProvider is missing');
  return value;
}

export function useNativeAppearance(mode: AppearanceMode): void {
  useEffect(() => {
    Appearance.setColorScheme(mode);
  }, [mode]);
  useEffect(() => () => Appearance.setColorScheme('unspecified'), []);
}
