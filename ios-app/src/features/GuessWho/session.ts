import * as SecureStore from 'expo-secure-store';
import { randomUUID } from 'expo-crypto';
import { getPersistenceScope } from '../../platform/persistence';
let identity: Promise<string> | null = null;
export function getGuestIdentity(): Promise<string> {
  if (!identity) identity = (async () => {
    const key = (await getPersistenceScope()).guestIdentityKey;
    const stored = await SecureStore.getItemAsync(key);
    if (stored !== null) { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) throw new Error('تعذر قراءة هوية اللاعب المحفوظة.'); return stored; }
    const created = randomUUID();
    await SecureStore.setItemAsync(key, created, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    return created;
  })().catch(error => { identity = null; throw error; });
  return identity;
}
// PORT NOTE: One native app session replaces the website tab identity. Keychain allows rejoining after process interruption, without account credentials.
// PORT STATUS: source resources/js/Lib/guessWhoSession.ts; confidence medium; todos 1 isolated native identity persistence verification.
