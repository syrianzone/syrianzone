import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Alert, AppState, View } from 'react-native';
import { api } from '../../api';
import { Label, Section } from '../../components';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAccount } from '../account';
import { formatDuration } from '../dates';
import { readDocument, writeDocument } from '../storage';
import { finiteNumber, record } from '../validation';
import type { QuranEngine } from './engine';
import { acknowledge, addListening, bytesForSeconds, decodeUsage, emptyUsage, formatBytes, pendingBatch, type UsageLedger, type UsageTotals } from './usage-model';

interface UsageState { session: UsageTotals; device: UsageTotals; account: UsageTotals | null; error: string | null; ready: boolean; clear(): Promise<void>; retry(): void }
const Context = createContext<UsageState | null>(null), KEY = 'syrian-zone.quran-usage.v1';
const totals = (seconds: number): UsageTotals => ({ seconds, bytes: bytesForSeconds(seconds) });
export function QuranUsageProvider({ engine, children }: { engine: QuranEngine; children: ReactNode }): React.JSX.Element {
  const account = useAccount(), [ledger, setLedger] = useState<UsageLedger>(emptyUsage), [session, setSession] = useState(0), [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  const player = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
  const current = useRef(ledger), latestAccount = useRef(account), baseline = useRef(0), sessionCounter = useRef(0), hydrated = useRef(false), writes = useRef(Promise.resolve()), inflight = useRef<Promise<void> | null>(null);
  const [accountTotals, setAccountTotals] = useState<UsageTotals | null>(null);
  const hydration = useRef<Promise<void> | null>(null);
  const clearing = useRef(false);
  latestAccount.current = account;
  const persist = useCallback((): Promise<void> => {
    const snapshot = current.current;
    const operation = writes.current.catch(() => undefined).then(() => writeDocument(KEY, snapshot));
    writes.current = operation; return operation;
  }, []);
  const hydrate = useCallback(async (): Promise<void> => {
    if (hydrated.current) return;
    if (hydration.current) return hydration.current;
    const operation = (async () => { try {
      const saved = await readDocument(KEY, decodeUsage, emptyUsage());
      const pending = { ...saved.pending };
      for (const [key, count] of Object.entries(current.current.pending)) pending[key] = (pending[key] ?? 0) + count;
      current.current = { seconds: saved.seconds + current.current.seconds, pending }; hydrated.current = true; setLedger(current.current); setReady(true); setError(null);
    } catch { setError('تعذر قراءة سجل الاستماع. لم يتم استبدال النسخة المحفوظة.'); }
    finally { hydration.current = null; } })();
    hydration.current = operation;
    await operation;
  }, []);
  useEffect(() => { void hydrate(); }, [hydrate]);
  useEffect(() => {
    const delta = Math.max(0, player.listenedSeconds - baseline.current); baseline.current = player.listenedSeconds;
    if (!delta) return;
    current.current = addListening(current.current, delta, latestAccount.current.user?.id ?? null); sessionCounter.current += delta;
    setLedger(current.current); setSession(sessionCounter.current);
  }, [player.listenedSeconds]);
  const userId = account.user?.id, accountSavedSeconds = account.user?.settings.quranRadioSeconds, accountSavedBytes = account.user?.settings.quranRadioBytes;
  useEffect(() => {
    setAccountTotals(userId === undefined ? null : { seconds: typeof accountSavedSeconds === 'number' ? Math.max(0, accountSavedSeconds) : 0,
      bytes: typeof accountSavedBytes === 'number' ? Math.max(0, accountSavedBytes) : 0 });
  }, [userId, accountSavedSeconds, accountSavedBytes]);
  const flush = useCallback(async (): Promise<void> => {
    if (clearing.current) return;
    if (!hydrated.current) { await hydrate(); if (!hydrated.current) return; }
    await persist();
    if (inflight.current) return inflight.current;
    const owner = latestAccount.current.user?.id, stamp = latestAccount.current.sessionGeneration;
    if (!owner) return;
    const batch = pendingBatch(current.current, owner);
    if (!batch) return;
    const operation = (async () => {
      const confirmed = await api.request('user/radio-usage', value => {
        const row = record(value), result = record(row.totals); if (row.status !== 'ok') throw new Error('لم يتم تأكيد سجل الاستماع.');
        return { seconds: finiteNumber(result.seconds), bytes: finiteNumber(result.bytes) };
      }, { method: 'POST', body: batch, authenticated: true, sessionGeneration: stamp });
      current.current = acknowledge(current.current, owner, batch.seconds); setLedger(current.current); await persist();
      if (stamp === latestAccount.current.sessionGeneration) setAccountTotals(confirmed);
    })();
    inflight.current = operation;
    try { await operation; setError(null); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذرت مزامنة سجل الاستماع.'); throw reason; }
    finally { inflight.current = null; }
  }, [hydrate, persist]);
  useEffect(() => {
    const local = setInterval(() => { if (hydrated.current) void persist().catch(() => setError('تعذر حفظ سجل الاستماع على الجهاز.')); }, 15000);
    const remote = setInterval(() => { void flush().catch(() => undefined); }, 60000);
    const lifecycle = AppState.addEventListener('change', state => { if (state !== 'active') void flush().catch(() => undefined); });
    return () => { clearInterval(local); clearInterval(remote); lifecycle.remove(); if (hydrated.current) void persist().catch(() => undefined); };
  }, [persist, flush]);
  useEffect(() => { if (!player.playing && ready) void flush().catch(() => undefined); }, [player.playing, ready, account.sessionGeneration, flush]);
  async function clear(): Promise<void> {
    if (!hydrated.current) throw new Error('انتظر اكتمال قراءة السجل أولاً.');
    if (clearing.current) return;
    clearing.current = true;
    try {
    await inflight.current?.catch(() => undefined);
    const previous = current.current, previousSession = sessionCounter.current, owner = account.user?.id, stamp = account.sessionGeneration;
    if (owner) await api.request('user/radio-usage', record, { method: 'DELETE', authenticated: true, sessionGeneration: stamp });
    const next = { seconds: Math.max(0, current.current.seconds - previous.seconds), pending: { ...current.current.pending } };
    if (owner) next.pending[String(owner)] = Math.max(0, (next.pending[String(owner)] ?? 0) - (previous.pending[String(owner)] ?? 0));
    current.current = next; sessionCounter.current = Math.max(0, sessionCounter.current - previousSession); setLedger(next); setSession(sessionCounter.current);
    if (stamp === latestAccount.current.sessionGeneration && owner) setAccountTotals(totals(0)); setError(null);
    await persist();
    } finally { clearing.current = false; }
  }
  return <Context.Provider value={{ session: totals(session), device: totals(ledger.seconds), account: accountTotals, error, ready, clear, retry: () => { void flush().catch(() => undefined); } }}>{children}</Context.Provider>;
}
export function QuranUsageCard(): React.JSX.Element {
  const state = useContext(Context), { colors } = useTheme(), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  if (!state) throw new Error('Listening usage provider is unavailable');
  function confirm(): void {
    Alert.alert('مسح سجل استهلاك البيانات؟', state?.account ? 'سيُمسح سجل هذا الجهاز وهذا الحساب نهائياً.' : 'سيُمسح سجل هذا الجهاز نهائياً.', [
      { text: 'إلغاء', style: 'cancel' }, { text: 'مسح', style: 'destructive', onPress: () => { setBusy(true); void state?.clear().catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر مسح السجل.')).finally(() => setBusy(false)); } }
    ]);
  }
  return <Section><Label style={{ fontWeight: '700' }}>استهلاك البيانات</Label><NativeAction title="مسح السجل" disabled={busy || !state.ready} onPress={confirm} />
    <Label secondary>الاستهلاك المتوقع: {formatBytes(bytesForSeconds(3600))} / ساعة</Label>
    {([['هذه الجلسة', state.session], ['هذا الجهاز', state.device], ...(state.account ? [['حسابك (كل الأجهزة)', state.account]] : [])] as [string, UsageTotals][]).map(([label, value]) => <View key={label}><Label>{label}</Label><Label secondary>{formatBytes(value.bytes)}، {formatDuration(value.seconds * 1000)}</Label></View>)}
    <Label secondary>تقدير محسوب من مدة التلاوة ومعدل ١٢٨ كيلوبت في الثانية، وقد يختلف عن البيانات المنقولة فعلياً.</Label>
    {error || state.error ? <><Label style={{ color: colors.danger }}>{error ?? state.error}</Label><NativeAction title="إعادة المحاولة" onPress={state.retry} /></> : null}
  </Section>;
}
