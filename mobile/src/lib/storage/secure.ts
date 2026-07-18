import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const secureKeys = {
  accessToken: 'sz-access-token',
  installationId: 'sz-installation-id',
  pendingAuth: 'sz-pending-auth',
  roomSession: 'sz-guess-who-session',
} as const;

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function readSecureValue(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, secureOptions);
  } catch {
    return null;
  }
}

async function writeSecureValue(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, secureOptions);
}

export const tokenStorage = {
  get: () => readSecureValue(secureKeys.accessToken),
  set: (token: string) => writeSecureValue(secureKeys.accessToken, token),
  clear: () => SecureStore.deleteItemAsync(secureKeys.accessToken),
};

export const roomSessionStorage = {
  get: () => readSecureValue(secureKeys.roomSession),
  set: (session: string) => writeSecureValue(secureKeys.roomSession, session),
  clear: () => SecureStore.deleteItemAsync(secureKeys.roomSession),
};

export const pendingAuthStorage = {
  get: () => readSecureValue(secureKeys.pendingAuth),
  set: (transaction: string) =>
    writeSecureValue(secureKeys.pendingAuth, transaction),
  clear: () => SecureStore.deleteItemAsync(secureKeys.pendingAuth),
};

export async function getInstallationId(): Promise<string> {
  const existing = await readSecureValue(secureKeys.installationId);
  if (existing) {
    return existing;
  }

  const created = Crypto.randomUUID();
  await writeSecureValue(secureKeys.installationId, created);
  return created;
}
