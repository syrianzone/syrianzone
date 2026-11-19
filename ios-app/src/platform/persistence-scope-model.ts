import { canonicalHttpsOrigin } from './site-origin';
import type { KeyValueStore } from '../storage';

export const legacyPersistence = {
  tokenKey: 'zone.syrian.ios.access-token',
  databaseName: 'ExpoSQLiteStorage',
  deviceKey: 'zone.syrian.ios.voter.v1',
  guestIdentityKey: 'syrian-zone.guesswho.identity.v1',
} as const;
export interface PersistenceScope {
  origin: string;
  tokenKey: string;
  databaseName: string;
  deviceKey: string;
  guestIdentityKey: string;
}
export function createPersistenceScopes(hash: (origin: string) => Promise<string>) {
  const cache = new Map<string, Promise<PersistenceScope>>();
  return (input: string): Promise<PersistenceScope> => {
    let origin: string;
    try {
      origin = canonicalHttpsOrigin(input);
    } catch (error) {
      return Promise.reject(error);
    }
    const existing = cache.get(origin);
    if (existing) return existing;
    const pending = (async (): Promise<PersistenceScope> => {
      if (origin === 'https://syrian.zone') return { origin, ...legacyPersistence };
      const digest = (await hash(origin)).toLowerCase();
      if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('تعذر إنشاء نطاق آمن للبيانات المحلية.');
      return {
        origin,
        tokenKey: `${legacyPersistence.tokenKey}.${digest}`,
        databaseName: `${legacyPersistence.databaseName}.${digest}`,
        deviceKey: `${legacyPersistence.deviceKey}.${digest}`,
        guestIdentityKey: `${legacyPersistence.guestIdentityKey}.${digest}`,
      };
    })().catch((error) => {
      cache.delete(origin);
      throw error;
    });
    cache.set(origin, pending);
    return pending;
  };
}

export function createScopedStorage<Store extends KeyValueStore>(
  scope: () => Promise<PersistenceScope>,
  open: (name: string) => Store,
) {
  let pending: Promise<Store> | null = null;
  const getStorage = (): Promise<Store> => {
    if (!pending)
      pending = scope()
        .then((value) => open(value.databaseName))
        .catch((error) => {
          pending = null;
          throw error;
        });
    return pending;
  };
  const storage: KeyValueStore = {
    getItemAsync: async (key) => (await getStorage()).getItemAsync(key),
    setItemAsync: async (key, value) => (await getStorage()).setItemAsync(key, value),
  };
  return { getStorage, storage };
}
