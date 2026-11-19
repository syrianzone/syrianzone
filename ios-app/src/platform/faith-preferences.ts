import { useEffect, useSyncExternalStore } from 'react';
import { useAccount } from './account';
import { readDocument, writeDocument } from './storage';
import { decodeFaithPreferences, defaultFaithPreferences, mergeFaithPreferences, todayKey, type FaithPreferences, type MethodConflict, type TrackedPrayer } from './faith-model';

export type { FaithPreferences, PrayerLog, TrackedPrayer } from './faith-model';
const KEY = 'syrian-zone.faith.preferences.v1';
let preferences = defaultFaithPreferences;
let status = { ready: false, error: null as string | null, methodConflict: null as MethodConflict | null };
let initial: Promise<void> | null = null;
let writes = Promise.resolve();
let mergedAccount = '';
let accountOwner: number | null = null;
const listeners = new Set<() => void>();
function emit(): void { listeners.forEach(callback => callback()); }
function subscribe(callback: () => void): () => void { listeners.add(callback); return () => { listeners.delete(callback); }; }
async function initialize(): Promise<void> {
  if (!initial) initial = readDocument(KEY, decodeFaithPreferences, defaultFaithPreferences).then(value => {
    preferences = value; status = { ...status, ready: true, error: null }; emit();
  }).catch((reason: unknown) => {
    initial = null; status = { ...status, ready: false, error: 'تعذر قراءة سجل العبادات المحفوظ. لم يتم تغييره.' }; emit(); throw reason;
  });
  await initial;
}
async function persist(patch: Partial<FaithPreferences> | ((previous: FaithPreferences) => Partial<FaithPreferences>)): Promise<void> {
  const operation = writes.catch(() => undefined).then(async () => {
    await initialize();
    const next = decodeFaithPreferences({ ...preferences, ...(typeof patch === 'function' ? patch(preferences) : patch) });
    await writeDocument(KEY, next);
    preferences = next; status = { ...status, error: null }; emit();
  });
  writes = operation;
  void writes.catch(() => { status = { ...status, error: 'تعذر حفظ التغيير على الجهاز. حاول مجدداً.' }; emit(); });
  return operation;
}
async function synchronize(userId: number, settings: Record<string, unknown>, save: (patch: Record<string, unknown>) => Promise<Record<string, unknown>>): Promise<void> {
  const key = `${userId}:${JSON.stringify([settings.muslimMethod, settings.prayerLog, settings.quranLastPage, settings.quranPageAt])}`;
  if (key === mergedAccount) return;
  mergedAccount = key;
  try {
    await initialize();
    if (accountOwner !== userId) return;
    let merged = mergeFaithPreferences(preferences, settings);
    await persist(previous => { merged = mergeFaithPreferences(previous, settings); return merged.preferences; });
    if (accountOwner !== userId) return;
    status = { ...status, methodConflict: merged.methodConflict }; emit();
    if (Object.keys(merged.serverPatch).length) await save(merged.serverPatch);
  } catch {
    if (accountOwner === userId) {
      mergedAccount = ''; status = { ...status, error: 'تعذرت مزامنة سجل العبادات. بقيت نسخة الجهاز محفوظة.' }; emit();
    }
  }
}
export function useFaithPreferences(): FaithPreferences & {
  ready: boolean; error: string | null; methodConflict: MethodConflict | null;
  setPreferences(patch: Partial<Pick<FaithPreferences, 'method' | 'prayerLog' | 'quranPage'>>): Promise<void>;
  togglePrayer(prayer: TrackedPrayer): Promise<void>;
  resolveMethodConflict(source: 'local' | 'account'): Promise<void>;
  retry(): void;
} {
  const account = useAccount();
  const value = useSyncExternalStore(subscribe, () => preferences, () => preferences);
  const state = useSyncExternalStore(subscribe, () => status, () => status);
  const userId = account.user?.id ?? null;
  const settings = account.user?.settings;
  useEffect(() => { void initialize().catch(() => undefined); }, []);
  useEffect(() => {
    accountOwner = userId;
    if (userId === null || !settings) { mergedAccount = ''; return; }
    // This is shared persistence work, so leaving one consuming screen does not cancel it.
    void synchronize(userId, settings, account.saveSettings);
  }, [account, settings, userId]);
  async function setPreferences(patch: Partial<Pick<FaithPreferences, 'method' | 'prayerLog' | 'quranPage'>>): Promise<void> {
    const changed = { ...patch, ...(patch.method !== undefined ? { methodChosen: true } : {}), ...(patch.quranPage !== undefined ? { quranPageAt: Date.now() } : {}) };
    await persist(changed);
    if (userId === null || accountOwner !== userId) return;
    const server: Record<string, unknown> = {};
    if (patch.method !== undefined) server.muslimMethod = preferences.method;
    if (patch.prayerLog !== undefined) server.prayerLog = preferences.prayerLog;
    if (patch.quranPage !== undefined) { server.quranLastPage = preferences.quranPage; server.quranPageAt = Math.floor(preferences.quranPageAt / 1000); }
    try { await account.saveSettings(server); }
    catch (reason) { status = { ...status, error: 'حُفظ التغيير على الجهاز وتعذرت مزامنته مع الحساب.' }; emit(); throw reason; }
  }
  return { ...value, ...state, setPreferences,
    async togglePrayer(prayer) {
      const day = todayKey();
      await persist(previous => ({ prayerLog: { ...previous.prayerLog, [day]: { ...previous.prayerLog[day], [prayer]: !previous.prayerLog[day]?.[prayer] } } }));
      if (userId !== null && accountOwner === userId) {
        try { await account.saveSettings({ prayerLog: preferences.prayerLog }); }
        catch (reason) { status = { ...status, error: 'حُفظ السجل على الجهاز وتعذرت مزامنته مع الحساب.' }; emit(); throw reason; }
      }
    },
    async resolveMethodConflict(source) {
      const conflict = status.methodConflict;
      if (!conflict) return;
      await setPreferences({ method: source === 'account' ? conflict.account : conflict.local });
      status = { ...status, methodConflict: null }; emit();
    },
    retry() {
      mergedAccount = '';
      if (userId !== null && settings) void synchronize(userId, settings, account.saveSettings);
      else void initialize().catch(() => undefined);
    }
  };
}
