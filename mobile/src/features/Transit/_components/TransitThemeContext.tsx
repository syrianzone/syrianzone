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
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

type TransitTheme = 'damascus-rose' | 'jasmine';

const TransitThemeContext = createContext<{
  theme: TransitTheme;
  toggleTheme: () => void;
} | null>(null);

export function TransitThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<TransitTheme>('jasmine');
  useEffect(() => {
    let active = true;
    void readStringPreference('transit-theme').then((value) => {
      if (active && (value === 'damascus-rose' || value === 'jasmine')) {
        setTheme(value);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === 'jasmine' ? 'damascus-rose' : 'jasmine';
      void writeStringPreference('transit-theme', next);
      return next;
    });
  }, []);
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
  source:     resources/js/Pages/Transit/_components/TransitThemeContext.tsx (47 lines)
  confidence: high
  todos:      0
  notes:      AsyncStorage replaces DOM attributes and localStorage.
*/
