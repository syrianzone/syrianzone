import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  type AuthContextType,
  useOptionalAuth,
} from '@/contexts/AuthContext';
import {
  accountSettingsApi,
  fromAccountHomeSettings,
  hasAccountHomeSettings,
  toAccountHomeSettings,
  type AccountSettingsApi,
} from '@/lib/auth/accountSettings';
import {
  defaultHomeSettings,
  homeSettingsSchema,
  type HomeSettings,
} from '@/lib/ported/home';
import {
  homeSettingsGuestClaim,
  homeSettingsPreferenceKey,
  preferenceKeys,
  readJsonPreference,
  readStringPreference,
  writeJsonPreference,
  writeStringPreference,
} from '@/lib/storage/preferences';

interface HomeSettingsContextValue {
  hydrated: boolean;
  settings: HomeSettings;
  updateSettings: (patch: Partial<HomeSettings>) => Promise<void>;
}

interface HomeSettingsProviderProps {
  accountSettingsApi?: AccountSettingsApi;
}

interface ScopedHomeSettingsProviderProps {
  accountSettingsApi: AccountSettingsApi;
  auth: AuthContextType | null;
  ready: boolean;
  storageKey: string;
}

const HomeSettingsContext = createContext<HomeSettingsContextValue | null>(null);

export function HomeSettingsProvider({
  accountSettingsApi: settingsApi = accountSettingsApi,
  children,
}: PropsWithChildren<HomeSettingsProviderProps>) {
  const auth = useOptionalAuth();
  const accountId = auth?.user?.id ?? null;
  const ready = auth === null || !auth.loading;
  const storageKey = homeSettingsPreferenceKey(accountId);

  return (
    <ScopedHomeSettingsProvider
      accountSettingsApi={settingsApi}
      auth={auth}
      key={ready ? storageKey : 'auth-loading'}
      ready={ready}
      storageKey={storageKey}
    >
      {children}
    </ScopedHomeSettingsProvider>
  );
}

function ScopedHomeSettingsProvider({
  accountSettingsApi: settingsApi,
  auth,
  children,
  ready,
  storageKey,
}: PropsWithChildren<ScopedHomeSettingsProviderProps>) {
  const accountId = auth?.user?.id ?? null;
  const [settings, setSettings] = useState(defaultHomeSettings);
  const [hydrated, setHydrated] = useState(false);
  const settingsRef = useRef(defaultHomeSettings);
  const reconciledUserRef = useRef<number | null>(null);
  const syncControllerRef = useRef<AbortController | null>(null);
  const syncInFlightRef = useRef(false);
  const pendingSyncRef = useRef<HomeSettings | null>(null);

  const storeSettings = useCallback((next: HomeSettings) => {
    settingsRef.current = next;
    setSettings(next);
    const writes: Promise<void>[] = [
      writeJsonPreference(storageKey, next),
    ];
    if (accountId === null) {
      writes.push(
        writeStringPreference(
          homeSettingsGuestClaim.key,
          homeSettingsGuestClaim.value,
        ),
      );
    }
    void Promise.all(writes).catch(() => undefined);
  }, [accountId, storageKey]);

  useEffect(() => {
    const controller = new AbortController();
    syncControllerRef.current = controller;
    return () => {
      controller.abort();
      pendingSyncRef.current = null;
      syncInFlightRef.current = false;
      if (syncControllerRef.current === controller) {
        syncControllerRef.current = null;
      }
    };
  }, []);

  const syncSettings = useCallback(
    function queueSettings(next: HomeSettings) {
      const controller = syncControllerRef.current;
      if (!controller || controller.signal.aborted) {
        return;
      }
      if (syncInFlightRef.current) {
        pendingSyncRef.current = next;
        return;
      }
      syncInFlightRef.current = true;
      void settingsApi
        .updateSettings(
          toAccountHomeSettings(next),
          controller.signal,
        )
        .catch(() => undefined)
        .finally(() => {
          if (
            syncControllerRef.current !== controller ||
            controller.signal.aborted
          ) {
            syncInFlightRef.current = false;
            pendingSyncRef.current = null;
            return;
          }
          syncInFlightRef.current = false;
          const pending = pendingSyncRef.current;
          pendingSyncRef.current = null;
          if (pending) {
            queueSettings(pending);
          }
        });
    },
    [settingsApi],
  );

  useEffect(() => {
    if (!ready) {
      return;
    }
    let active = true;
    void readJsonPreference(storageKey, homeSettingsSchema)
      .then(async (stored) => {
        if (accountId === null) {
          if (stored) {
            await writeStringPreference(
              homeSettingsGuestClaim.key,
              homeSettingsGuestClaim.value,
            ).catch(() => undefined);
          }
          return stored;
        }
        if (stored) {
          return stored;
        }
        const guestClaim = await readStringPreference(
          homeSettingsGuestClaim.key,
        );
        if (guestClaim !== homeSettingsGuestClaim.value) {
          return null;
        }
        return readJsonPreference(
          preferenceKeys.homeSettings,
          homeSettingsSchema,
        );
      })
      .then((stored) => {
        if (active && stored) {
          settingsRef.current = stored;
          setSettings(stored);
        }
        if (active) {
          setHydrated(true);
        }
      })
      .catch(() => {
        if (active) {
          setHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, [accountId, ready, storageKey]);

  useEffect(() => {
    if (!hydrated || !auth || auth.loading) {
      return;
    }
    if (!auth.user) {
      reconciledUserRef.current = null;
      return;
    }
    if (reconciledUserRef.current === auth.user.id) {
      return;
    }
    reconciledUserRef.current = auth.user.id;

    const rootSettings = auth.user.settings;
    const hasServerHome =
      rootSettings !== undefined &&
      hasAccountHomeSettings(rootSettings);
    if (hasServerHome) {
      const serverHome = fromAccountHomeSettings(
        rootSettings,
        settingsRef.current,
      );
      if (serverHome) {
        storeSettings(serverHome);
      }
      return;
    }

    storeSettings(settingsRef.current);
    syncSettings(settingsRef.current);
  }, [auth, hydrated, storeSettings, syncSettings]);

  const updateSettings = useCallback(
    async (patch: Partial<HomeSettings>) => {
      const next = homeSettingsSchema.parse({
        ...settingsRef.current,
        ...patch,
      });
      storeSettings(next);
      if (auth?.user) {
        syncSettings(next);
      }
    },
    [auth?.user, storeSettings, syncSettings],
  );

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
