import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';

export const preferenceKeys = {
  dismissUnblockSyria: 'unblock_syria_notif_dismissed',
  locale: 'sz-locale',
  theme: 'sz-theme',
  homeSettings: 'startpage-settings',
} as const;

export async function readStringPreference(
  key: string,
): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function writeStringPreference(
  key: string,
  value: string,
): Promise<void> {
  await AsyncStorage.setItem(key, value);
}

export async function readJsonPreference<T>(
  key: string,
  schema: z.ZodType<T>,
): Promise<T | null> {
  const value = await readStringPreference(key);
  if (value === null) {
    return null;
  }

  try {
    return schema.parse(JSON.parse(value));
  } catch {
    await AsyncStorage.removeItem(key);
    return null;
  }
}

export async function writeJsonPreference(
  key: string,
  value: unknown,
): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
