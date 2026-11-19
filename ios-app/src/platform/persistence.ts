import * as Crypto from 'expo-crypto';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import type { KeyValueStore } from '../storage';
import {
  createPersistenceScopes,
  createScopedStorage,
  type PersistenceScope,
} from './persistence-scope-model';
import { configuredSiteOrigin } from './site-origin';

const scopes = createPersistenceScopes((origin) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, origin, {
    encoding: Crypto.CryptoEncoding.HEX,
  }),
);
export function getPersistenceScope(): Promise<PersistenceScope> {
  return scopes(configuredSiteOrigin);
}
const scoped = createScopedStorage(getPersistenceScope, (name) => new SQLiteStorage(name));
export function getPersonalStorage(): Promise<SQLiteStorage> {
  return scoped.getStorage();
}
export const personalStorage: KeyValueStore = scoped.storage;
