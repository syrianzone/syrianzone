import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  getThemeById,
  isThemePreference,
  resolveTheme,
  SYSTEM_THEME,
  type ThemeConfig,
  type ThemePreference,
} from '@/lib/ported/theme';
import {
  preferenceKeys,
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

interface ThemeContextValue {
  hydrated: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
  theme: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] =
    useState<ThemePreference>(SYSTEM_THEME);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void readStringPreference(preferenceKeys.theme).then((stored) => {
      if (active && isThemePreference(stored)) {
        setPreferenceState(stored);
      }
      if (active) {
        setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback(async (next: ThemePreference) => {
    setPreferenceState(next);
    await writeStringPreference(preferenceKeys.theme, next);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const themeId = resolveTheme(preference, systemScheme === 'dark');
    const theme = getThemeById(themeId);
    if (!theme) {
      throw new Error(`Theme ${themeId} is not registered`);
    }
    return {
      hydrated,
      preference,
      setPreference,
      theme,
    };
  }, [hydrated, preference, setPreference, systemScheme]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useAppTheme must be used within AppThemeProvider');
  }
  return context;
}
