import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
} from 'react';

import { useAppTheme } from '@/contexts/ThemeContext';

import { transitThemeForApp } from '../model';

type TransitTheme = 'damascus-rose' | 'jasmine';

const TransitThemeContext = createContext<{
  theme: TransitTheme;
  toggleTheme: () => void;
} | null>(null);

export function TransitThemeProvider({ children }: PropsWithChildren) {
  const { setPreference, theme: appTheme } = useAppTheme();
  const theme = transitThemeForApp(appTheme.isDark);
  const toggleTheme = useCallback(() => {
    void setPreference(theme === 'jasmine' ? 'damascus-rose' : 'jasmine');
  }, [setPreference, theme]);
  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);
  return (
    <TransitThemeContext.Provider value={value}>
      {children}
    </TransitThemeContext.Provider>
  );
}

export function useTransitTheme() {
  const context = useContext(TransitThemeContext);
  if (!context) {
    throw new Error('useTransitTheme must be used within TransitThemeProvider');
  }
  return context;
}

/*
PORT STATUS
  source:     resources/js/Pages/Transit/_components/TransitThemeContext.tsx (66 lines)
  confidence: high
  todos:      0
  notes:      The transit palette follows the global native theme and keeps the heritage toggle available.
*/
