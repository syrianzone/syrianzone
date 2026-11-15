import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { createInstallationId } from './device-model';
import { getPersistenceScope } from './persistence';

export const getDeviceId = createInstallationId({ read: async () => SecureStore.getItemAsync((await getPersistenceScope()).deviceKey),
  write: async value => SecureStore.setItemAsync((await getPersistenceScope()).deviceKey, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }), random: randomUUID });
