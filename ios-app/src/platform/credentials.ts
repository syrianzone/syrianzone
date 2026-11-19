import * as SecureStore from 'expo-secure-store';
import { createCredentialTransactions } from './credential-transactions';
import { getPersistenceScope } from './persistence';

const transactions = createCredentialTransactions({
  read: key => SecureStore.getItemAsync(key),
  write: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  remove: key => SecureStore.deleteItemAsync(key),
});
export async function readAccessToken(): Promise<string | null> {
  try { return await transactions.read((await getPersistenceScope()).tokenKey); }
  catch (cause) { throw new Error('تعذر قراءة تسجيل الدخول المحفوظ. افتح الجهاز ثم حاول مجدداً.', { cause }); }
}
export async function replaceAccessToken(value: string | null, isCurrent: () => boolean, onCommit: () => void): Promise<boolean> {
  try { return await transactions.replace((await getPersistenceScope()).tokenKey, value, isCurrent, onCommit); }
  catch (cause) { throw new Error('تعذر تحديث تسجيل الدخول المحفوظ. افتح الجهاز ثم أعد المحاولة.', { cause }); }
}
