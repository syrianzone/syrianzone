import { useCallback, useEffect, useRef } from 'react';
import { usePage } from '@inertiajs/react';
import { create } from 'zustand';
import axios from '@/lib/axios';
import { useQuranPlayer } from './quranPlayer';
import {
  BYTES_PER_HOUR, EMPTY_TOTALS, addDeviceUsage, addPendingUsage, addSessionUsage,
  bytesForSeconds, clearPendingUsage, clearUsage, getDeviceTotals, getPendingDelta,
  getSessionTotals, persistUsage, type UsageTotals,
} from './radioUsage';

// Listening-time accounting, global. The player is a singleton, so accrual must
// be too: it runs once (useUsageTracker, mounted by GlobalRuntime) and writes
// into this store, which every usage readout subscribes to.

const TICK_MS = 1_000;
const PERSIST_MS = 15_000;
const PUSH_MS = 60_000;

interface UsageState {
  session: UsageTotals;
  device: UsageTotals;
  account: UsageTotals | null;
  isLoggedIn: boolean;
  perHour: number;
}

export const useUsageStore = create<UsageState>(() => ({
  session: getSessionTotals(),
  device: getDeviceTotals(),
  account: null,
  isLoggedIn: false,
  perHour: BYTES_PER_HOUR,
}));

/** Zero local counters (and the account's, when signed in). */
export async function clearAllUsage(): Promise<void> {
  const { isLoggedIn } = useUsageStore.getState();
  clearUsage();
  useUsageStore.setState({
    session: { ...EMPTY_TOTALS },
    device: { ...EMPTY_TOTALS },
    account: isLoggedIn ? { ...EMPTY_TOTALS } : null,
  });
  if (!isLoggedIn) return;
  try {
    await axios.post('/api/user/radio-usage/clear');
  } catch {
    /* local counters are already gone; the account clears next time */
  }
}

/** Mounted once per layout: banks listening time while the player runs. */
export function useUsageTracker(): void {
  const { props } = usePage<{ auth?: { user?: { id?: number; settings?: Record<string, unknown> | null } | null } }>();
  const user = props.auth?.user ?? null;
  const isLoggedIn = Boolean(user?.id);
  const isPlaying = useQuranPlayer((s) => s.playing);

  const seeded = useRef(false);
  useEffect(() => {
    useUsageStore.setState({ isLoggedIn });
    if (seeded.current) return;
    if (!isLoggedIn) {
      useUsageStore.setState({ account: null });
      return;
    }
    seeded.current = true;
    const s = user?.settings ?? {};
    useUsageStore.setState({
      account: {
        bytes: Number(s.quranRadioBytes ?? 0) || 0,
        seconds: Number(s.quranRadioSeconds ?? 0) || 0,
      },
    });
  }, [isLoggedIn, user?.settings]);

  const lastAccruedAt = useRef(Date.now());
  const lastPersistAt = useRef(Date.now());
  const lastPushAt = useRef(Date.now());
  const pushing = useRef(false);

  const bank = useCallback((seconds: number) => {
    if (seconds < 1) return;
    const delta = { seconds, bytes: bytesForSeconds(seconds) };
    addSessionUsage(delta);
    addDeviceUsage(delta);
    addPendingUsage(delta);
    useUsageStore.setState({ session: getSessionTotals(), device: getDeviceTotals() });
  }, []);

  const pushPending = useCallback(async () => {
    if (!isLoggedIn) return;
    const pending = getPendingDelta();
    if (pending.seconds <= 0 && pending.bytes <= 0) return;
    if (pushing.current) return;
    pushing.current = true;
    persistUsage();
    try {
      const res = await axios.post('/api/user/radio-usage', pending);
      const totals = res.data?.totals;
      if (totals) {
        useUsageStore.setState({
          account: { bytes: Number(totals.bytes) || 0, seconds: Number(totals.seconds) || 0 },
        });
      }
      clearPendingUsage();
      persistUsage();
    } catch {
      /* offline or throttled */
    } finally {
      pushing.current = false;
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      const seconds = (now - lastAccruedAt.current) / 1000;
      lastAccruedAt.current = now;
      bank(seconds);
      if (now - lastPersistAt.current >= PERSIST_MS) {
        lastPersistAt.current = now;
        persistUsage();
      }
      if (now - lastPushAt.current >= PUSH_MS) {
        lastPushAt.current = now;
        void pushPending();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [bank, isPlaying, pushPending]);

  useEffect(() => {
    if (isPlaying) return;
    const now = Date.now();
    const seconds = (now - lastAccruedAt.current) / 1000;
    lastAccruedAt.current = now;
    bank(seconds);
    lastPersistAt.current = now;
    persistUsage();
    void pushPending();
  }, [bank, isPlaying, pushPending]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      persistUsage();
      void pushPending();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [pushPending]);

  useEffect(() => () => persistUsage(), []);
}
