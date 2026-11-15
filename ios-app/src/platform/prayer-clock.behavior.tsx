import { afterEach, beforeEach, expect, mock, setSystemTime, spyOn, test } from 'bun:test';
import { createElement, useSyncExternalStore } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { api, type ApiClient } from '../api';
import { defaultLocation } from './location-model';
import type { PrayerResource } from './prayer';

let focused = true;
const focusListeners = new Set<() => void>(), appListeners = new Set<() => void>();
const appState = {
  currentState: 'active',
  addEventListener: (_event: string, listener: () => void) => {
    appListeners.add(listener);
    return { remove: () => { appListeners.delete(listener); } };
  }
};
mock.module('react-native', () => ({ AppState: appState }));
mock.module('@react-navigation/native', () => ({
  useIsFocused: () => useSyncExternalStore(listener => { focusListeners.add(listener); return () => { focusListeners.delete(listener); }; }, () => focused)
}));
mock.module('./storage', () => ({ readDocument: async () => null, writeDocument: async () => {} }));
mock.module('./location-zone', () => ({
  knownPrayerZone: () => 'Asia/Damascus', resolvePrayerZone: async () => 'Asia/Damascus', rememberPrayerZone: () => {}
}));
const { usePrayerTimes } = await import('./prayer');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

interface Interval { callback(): void; delay: number; next: number }
const intervals = new Map<number, Interval>(), requestedDays: string[] = [], signals: AbortSignal[] = [], renders: PrayerResource[] = [];
let nextInterval = 1, now = 0, mounted: ReactTestRenderer | undefined;
let restoreSpies: (() => void)[] = [];
let holdResponse: Promise<void> | null = null;

function Probe({ enabled }: { enabled: boolean }): React.ReactNode {
  const prayer = usePrayerTimes(defaultLocation, 3, enabled);
  renders.push(prayer);
  return createElement('output', null, prayer.schedule()?.next?.time ?? 'none');
}

beforeEach(() => {
  now = Date.parse('2026-11-14T08:00:00Z');
  setSystemTime(now);
  focused = true; appState.currentState = 'active'; nextInterval = 1;
  intervals.clear(); requestedDays.length = 0; signals.length = 0; renders.length = 0; holdResponse = null;
  const schedule = (callback: TimerHandler, delay = 0): number => {
    if (typeof callback !== 'function' || !delay || delay < 1) throw new Error('A clock interval needs a positive cadence.');
    const id = nextInterval++;
    intervals.set(id, { callback: () => { callback(); }, delay, next: now + delay });
    return id;
  };
  const interval = spyOn(globalThis, 'setInterval').mockImplementation(schedule as unknown as typeof setInterval);
  const clear = spyOn(globalThis, 'clearInterval').mockImplementation(handle => { intervals.delete(Number(handle)); });
  const request: ApiClient['request'] = async (path, decode, options) => {
    if (path !== 'prayer-times' || typeof options?.params?.date !== 'string') throw new Error('The actual prayer date request was required.');
    requestedDays.push(options.params.date);
    if (!options.signal) throw new Error('Prayer data must keep its cancellation signal.');
    signals.push(options.signal);
    if (holdResponse) await holdResponse;
    return decode({
      governorate: 'damascus', latitude: 33.5138, longitude: 36.2765, method: 3,
      date: options.params.date, timezone: 'Asia/Damascus', hijri: null,
      timings: { Fajr: '05:00', Sunrise: '06:30', Dhuhr: '12:00', Asr: '15:00', Maghrib: '17:00', Isha: '19:00' }
    });
  };
  const read = spyOn(api, 'request').mockImplementation(request);
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  restoreSpies = [() => interval.mockRestore(), () => clear.mockRestore(), () => read.mockRestore(), () => {
    const messages = warning.mock.calls.map(call => call[0]);
    warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }];
});

afterEach(async () => {
  if (mounted) await act(async () => { mounted?.unmount(); });
  mounted = undefined;
  const remainingListeners = appListeners.size + focusListeners.size;
  for (const restore of restoreSpies) restore();
  restoreSpies = [];
  setSystemTime();
  expect(intervals.size).toBe(0);
  expect(remainingListeners).toBe(0);
});

async function render(enabled: boolean): Promise<void> {
  await act(async () => {
    const element = createElement(Probe, { enabled });
    if (mounted) mounted.update(element); else mounted = create(element);
  });
}

// Advance real hook consumers one clock step per React commit. Wall-clock
// timing cannot establish whether a hidden consumer still receives callbacks.
async function advance(seconds: number): Promise<void> {
  for (let second = 0; second < seconds; second++) {
    await act(async () => {
      now += 1000;
      setSystemTime(now);
      for (const timer of [...intervals.values()]) {
        if (timer.next > now) continue;
        timer.next += timer.delay;
        timer.callback();
      }
    });
  }
}

async function setForeground(value: boolean): Promise<void> {
  await act(async () => { appState.currentState = value ? 'active' : 'background'; for (const listener of appListeners) listener(); });
}

async function setFocused(value: boolean): Promise<void> {
  await act(async () => { focused = value; for (const listener of focusListeners) listener(); });
}

test('a hidden prayer widget causes no timer-driven renders over sixty foreground seconds', async () => {
  await render(false);
  const initialRenders = renders.length;
  await advance(60);
  expect(renders.length - initialRenders).toBe(0);
  expect(intervals.size).toBe(0);
  expect(requestedDays).toEqual([]);
});

test('showing a prayer widget refreshes its clock immediately and keeps the existing one-second cadence', async () => {
  await render(false);
  await advance(120);
  await render(true);
  expect(renders.at(-1)?.now.getTime()).toBe(now);
  expect(renders.at(-1)?.fresh).toBe(true);
  expect(renders.at(-1)?.schedule()?.next?.time).toBe('12:00');
  expect(requestedDays).toEqual(['2026-11-14']);
  const initialRenders = renders.length;
  await advance(1);
  expect(renders.length - initialRenders).toBe(1);
  expect(renders.at(-1)?.now.getTime()).toBe(now);
  await render(false);
  const hiddenRenders = renders.length;
  await advance(60);
  expect(renders.length).toBe(hiddenRenders);
  expect(intervals.size).toBe(0);
  await render(true);
  expect(renders.at(-1)?.now.getTime()).toBe(now);
  expect(requestedDays).toEqual(['2026-11-14']);
});

test('background and navigation blur suspend the prayer clock and foreground or refocus catches up', async () => {
  await render(true);
  await setForeground(false);
  let pausedRenders = renders.length;
  await advance(60);
  expect(renders.length).toBe(pausedRenders);
  expect(intervals.size).toBe(0);
  await setForeground(true);
  expect(renders.at(-1)?.now.getTime()).toBe(now);
  expect(intervals.size).toBe(1);
  await setFocused(false);
  pausedRenders = renders.length;
  await advance(60);
  expect(renders.length).toBe(pausedRenders);
  expect(intervals.size).toBe(0);
  await setFocused(true);
  expect(renders.at(-1)?.now.getTime()).toBe(now);
  expect(intervals.size).toBe(1);
});

test('showing the widget after a hidden midnight requests the new selected-zone day', async () => {
  now = Date.parse('2026-11-14T20:59:59Z');
  setSystemTime(now);
  await render(true);
  expect(renders.at(-1)?.cachedDay).toBe('2026-11-14');
  await render(false);
  await advance(2);
  await render(true);
  expect(renders.at(-1)?.now.getTime()).toBe(now);
  expect(renders.at(-1)?.cachedDay).toBe('2026-11-15');
  expect(renders.at(-1)?.fresh).toBe(true);
  expect(requestedDays).toEqual(['2026-11-14', '2026-11-15']);
});

test('clock ticks preserve an active prayer request while hiding still cancels it and rejects a late reply', async () => {
  let release!: () => void;
  holdResponse = new Promise<void>(resolve => { release = resolve; });
  await render(true);
  expect(requestedDays).toEqual(['2026-11-14']);
  expect(signals[0]?.aborted).toBe(false);
  await advance(2);
  expect(requestedDays).toHaveLength(1);
  expect(signals[0]?.aborted).toBe(false);
  await render(false);
  expect(signals[0]?.aborted).toBe(true);
  const hiddenRenders = renders.length;
  await advance(60);
  expect(renders.length).toBe(hiddenRenders);
  holdResponse = null;
  await render(true);
  expect(requestedDays).toEqual(['2026-11-14', '2026-11-14']);
  expect(signals[1]?.aborted).toBe(false);
  expect(renders.at(-1)?.fresh).toBe(true);
  const completedRenders = renders.length;
  await act(async () => { release(); });
  expect(renders.length).toBe(completedRenders);
});
