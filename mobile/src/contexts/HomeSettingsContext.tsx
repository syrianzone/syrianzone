import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  defaultHomeSettings,
  homeSettingsSchema,
  type HomeSettings,
} from '@/lib/ported/home';
import {
  preferenceKeys,
  readJsonPreference,
  writeJsonPreference,
} from '@/lib/storage/preferences';

interface HomeSettingsContextValue {
  hydrated: boolean;
  settings: HomeSettings;
  updateSettings: (patch: Partial<HomeSettings>) => Promise<void>;
}

const HomeSettingsContext = createContext<HomeSettingsContextValue | null>(null);

export function HomeSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState(defaultHomeSettings);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void readJsonPreference(preferenceKeys.homeSettings, homeSettingsSchema).then(
      (stored) => {
        if (active && stored) {
          setSettings(stored);
        }
        if (active) {
          setHydrated(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const updateSettings = useCallback(async (patch: Partial<HomeSettings>) => {
    setSettings((current) => {
      const next = homeSettingsSchema.parse({ ...current, ...patch });
      void writeJsonPreference(preferenceKeys.homeSettings, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ hydrated, settings, updateSettings }),
    [hydrated, settings, updateSettings],
  );

  return (
    <HomeSettingsContext.Provider value={value}>
      {children}
    </HomeSettingsContext.Provider>
  );
}

export function useHomeSettings(): HomeSettingsContextValue {
  const context = useContext(HomeSettingsContext);
  if (!context) {
    throw new Error('useHomeSettings must be used within HomeSettingsProvider');
  }
  return context;
}
