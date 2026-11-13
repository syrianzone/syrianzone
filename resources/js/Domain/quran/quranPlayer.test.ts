import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuranPlayer } from './quranPlayer';

/**
 * The sleep deadline belongs to the player, not to `/muslim/radio`: the audio
 * element survives every route change, so the timer has to as well. Each case
 * here mounts no component at all, which is exactly the situation the old
 * page-local store could not cover.
 */
describe('quranPlayer sleep deadline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  });

  afterEach(() => {
    useQuranPlayer.getState().setSleepUntil(null);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('clears the deadline when it arrives, with no page mounted', () => {
    useQuranPlayer.getState().setSleepUntil(Date.now() + 60_000);
    expect(useQuranPlayer.getState().sleepUntil).not.toBeNull();

    vi.advanceTimersByTime(60_000);

    expect(useQuranPlayer.getState().sleepUntil).toBeNull();
  });

  it('keeps the deadline until it is reached', () => {
    const until = Date.now() + 60_000;
    useQuranPlayer.getState().setSleepUntil(until);

    vi.advanceTimersByTime(59_000);

    expect(useQuranPlayer.getState().sleepUntil).toBe(until);
  });

  it('cancels a pending deadline when the visitor picks "no timer"', () => {
    useQuranPlayer.getState().setSleepUntil(Date.now() + 60_000);
    useQuranPlayer.getState().setSleepUntil(null);

    vi.advanceTimersByTime(120_000);

    expect(useQuranPlayer.getState().sleepUntil).toBeNull();
  });
});
