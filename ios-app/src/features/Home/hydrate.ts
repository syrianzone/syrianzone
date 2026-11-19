import { decodeHomePreferences, type HomePreferences } from './model';

export async function hydrateHomePreferences(local: HomePreferences, accountSettings: Record<string, unknown> | null, writeLocal: (value: HomePreferences) => Promise<void>): Promise<{
  value: HomePreferences; appearance: 'light' | 'dark' | null; seedAccount: boolean;
}> {
  const value = decodeHomePreferences({ ...local, ...accountSettings });
  if (accountSettings !== null) await writeLocal(value);
  return { value, appearance: accountSettings?.theme === 'light' || accountSettings?.theme === 'dark' ? accountSettings.theme : null,
    seedAccount: accountSettings !== null && Object.keys(accountSettings).length === 0 };
}
