// Turns playback into usage figures: a projection, a session counter, a device
// counter, and — for a signed-in user — a server counter that spans devices.
//
// The readouts tick every second while a stream runs. Persistence is slower on
// purpose: localStorage writes are synchronous, and the server gets a delta at
// most once a minute.

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@inertiajs/react';
import axios from '@/lib/axios';
import {
  addDeviceUsage,
  addPendingUsage,
  addSessionUsage,
  bytesForSeconds,
  clearPendingUsage,
  clearUsage,
  getDeviceTotals,
  getPendingDelta,
  getSessionTotals,
  loadUsage,
  persistUsage,
  BYTES_PER_HOUR,
  EMPTY_TOTALS,
  type UsageTotals,
} from './radioUsage';

/** How often the readouts move while playing. */
const TICK_MS = 1_000;
/** How often the counters are written to localStorage. */
const PERSIST_MS = 15_000;
/** How often banked time is pushed to the account, at most. */
const PUSH_MS = 60_000;

export interface RadioUsage {
  /** Bytes one hour of listening costs, from the stream bitrate. */
  perHour: number;
  session: UsageTotals;
  device: UsageTotals;
  /** Signed-in only: cumulative across devices, or null for a guest. */
  account: UsageTotals | null;
  isLoggedIn: boolean;
  clear: () => Promise<void>;
}

/**
 * @param isPlaying whether a stream is currently running
 */
export function useRadioUsage(isPlaying: boolean): RadioUsage {
  const { props } = usePage<{ auth?: { user?: { id?: number; settings?: Record<string, unknown> | null } | null } }>();
  const user = props.auth?.user ?? null;
  const isLoggedIn = Boolean(user?.id);

  const [session, setSession] = useState<UsageTotals>(() => getSessionTotals());
  const [device, setDevice] = useState<UsageTotals>(() => getDeviceTotals());
  const [account, setAccount] = useState<UsageTotals | null>(null);

  // Seeded from the page props once. Those are a snapshot, so re-seeding on
  // every Inertia visit would clobber the totals the pushes have since earned.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (!isLoggedIn) {
      setAccount(null);
      return;
    }
    seeded.current = true;
    const s = user?.settings ?? {};
    setAccount({
      bytes: Number(s.quranRadioBytes ?? 0) || 0,
      seconds: Number(s.quranRadioSeconds ?? 0) || 0,
    });
  }, [isLoggedIn, user?.settings]);

  // Wall clock, not a media-element clock: a backgrounded tab has its timers
  // throttled to a minute while the listener is still listening.
  const lastAccruedAt = useRef<number>(Date.now());
  const lastPersistAt = useRef<number>(Date.now());
  const lastPushAt = useRef<number>(Date.now());
  const pushing = useRef(false);

  const bank = useCallback((seconds: number) => {
    // Sub-second remainders are mount noise, not listening; counting them
    // would put a few hundred phantom bytes in every session.
    if (seconds < 1) return;
    const delta = { seconds, bytes: bytesForSeconds(seconds) };
    addSessionUsage(delta);
    addDeviceUsage(delta);
    addPendingUsage(delta);
    setSession(getSessionTotals());
    setDevice(getDeviceTotals());
  }, []);

  const pushPending = useCallback(async () => {
    if (!isLoggedIn) return;
    const pending = getPendingDelta();
    if (pending.seconds <= 0 && pending.bytes <= 0) return;
    // One push at a time: the delta is only cleared after the server accepts
    // it, so two in flight would add the same listening twice.
    if (pushing.current) return;
    pushing.current = true;
    persistUsage();
    try {
      const res = await axios.post('/api/user/radio-usage', pending);
      const totals = res.data?.totals;
      if (totals) setAccount({ bytes: Number(totals.bytes) || 0, seconds: Number(totals.seconds) || 0 });
      // The server added exactly this delta, so it is spent. A failure above
      // leaves it pending and it goes out with the next push.
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

  // Bank whatever is outstanding whenever playback stops, and ship it. This
  // also runs on mount, which is when a previous session's leftovers go out.
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

  // Best-effort last write and push when the page is hidden. The counters live
  // in localStorage, so anything unsent is late rather than lost.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== 'hidden') return;
      persistUsage();
      void pushPending();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [pushPending]);

  // Never leave a tab with unwritten counters.
  useEffect(() => () => persistUsage(), []);

  const clear = useCallback(async () => {
    clearUsage();
    setSession({ ...EMPTY_TOTALS });
    setDevice({ ...EMPTY_TOTALS });
    if (!isLoggedIn) {
      setAccount(null);
      return;
    }
    setAccount({ ...EMPTY_TOTALS });
    try {
      await axios.post('/api/user/radio-usage/clear');
    } catch {
      /* local counters are already gone; the account total clears next time */
    }
  }, [isLoggedIn]);

  return { perHour: BYTES_PER_HOUR, session, device, account, isLoggedIn, clear };
}
