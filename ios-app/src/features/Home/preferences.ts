import { useEffect, useState } from 'react';
import { useAccount } from '../../platform/account';
import { readDocument, writeDocument } from '../../platform/storage';
import { decodeHomePreferences, defaultPreferences, type HomePreferences } from './model';
import { hydrateHomePreferences } from './hydrate';
import { useAppState } from '../../state';
import { useTheme } from '../../ui/theme';

export function useHomePreferences(): { value: HomePreferences; ready: boolean; busy: boolean; error: string | null; save(next: HomePreferences): Promise<void>; retry(): void } {
  const account = useAccount();
  const appState = useAppState();
  const { mode } = useTheme();
  const [value, setValue] = useState(defaultPreferences);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const accountId = account.user?.id ?? null;
  useEffect(() => {
    if (!account.ready) return;
    let cancelled = false;
    setReady(false);
    void readDocument('home.v1', decodeHomePreferences, defaultPreferences).then(async local => {
      if (cancelled) return;
      const resolved = await hydrateHomePreferences(local, account.user?.settings ?? null, next => writeDocument('home.v1', next));
      if (cancelled) return;
      setValue(resolved.value); setReady(true); setError(null);
      if (resolved.appearance && !(await appState.setAppearance(resolved.appearance))) throw new Error('تعذر حفظ مظهر الحساب على الجهاز.');
      if (!cancelled && resolved.seedAccount) await account.saveSettings({ ...resolved.value, theme: mode });
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'تعذر قراءة إعدادات الرئيسية. لم يتم تغيير بياناتك المحفوظة.'); });
    return () => { cancelled = true; };
    // Account changes seed once; a settings write must not reset a form in progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.ready, accountId, revision]);
  async function save(next: HomePreferences): Promise<void> {
    if (!ready || busy) throw new Error('جارٍ حفظ إعدادات الرئيسية. حاول مجدداً.');
    setBusy(true); setError(null);
    try {
      const checked = decodeHomePreferences(next);
      await writeDocument('home.v1', checked);
      setValue(checked);
      if (account.user) await account.saveSettings({ ...checked });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ الإعدادات.'); throw reason; }
    finally { setBusy(false); }
  }
  return { value, ready, busy, error, save, retry: () => setRevision(previous => previous + 1) };
}
