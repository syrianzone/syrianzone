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
  isLocale,
  type Locale,
  type StringKey,
  strings,
} from '@/lib/i18n/strings';
import {
  preferenceKeys,
  readStringPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

interface LocaleContextValue {
  direction: 'rtl' | 'ltr';
  hydrated: boolean;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  textAlign: 'right' | 'left';
  t: (key: StringKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<Locale>('ar');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void readStringPreference(preferenceKeys.locale).then((stored) => {
      if (active && isLocale(stored)) {
        setLocaleState(stored);
      }
      if (active) {
        setHydrated(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    await writeStringPreference(preferenceKeys.locale, nextLocale);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      direction: locale === 'ar' ? 'rtl' : 'ltr',
      hydrated,
      locale,
      setLocale,
      textAlign: locale === 'ar' ? 'right' : 'left',
      t: (key) => strings[locale][key] ?? strings.ar[key],
    }),
    [hydrated, locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return context;
}
