import { describe, expect, test } from 'bun:test';
import { createQuranEngine, type NativeAudioPort } from './engine';
import type { QuranProvider, SurahAudio } from './provider';

function fixture() {
  const loads: { url: string; seconds: number; token: number }[] = [], seeks: number[] = [], sleeps: (number | null)[] = [];
  let releases = 0;
  const native: NativeAudioPort = {
    load: async (url, seconds, token) => { loads.push({ url, seconds, token }); }, play: async () => {}, pause: async () => {}, stop: async () => {},
    seek: async seconds => { seeks.push(seconds); }, volume: async () => {}, sleep: async until => { sleeps.push(until); }, metadata: async () => {}, release: async () => { releases++; }
  };
  const audio: SurahAudio = { url: 'https://cdn.mp3quran.net/audio/mahmoud-husary/r1/001-64k.mp3', ayahs: [[1, 1000, 2000], [2, 3000, 4000]], words: [], text: new Map(), fallback: false };
  const provider: QuranProvider = { surah: async () => audio, letters: async () => [] };
  const engine = createQuranEngine(native, provider);
  return { engine, provider, native, audio, loads, seeks, sleeps, releases: () => releases };
}
describe('single native Quran playback owner', () => {
  test('starts an Ayah at its timing and seeks next within the same Surah file', async () => {
    const { engine, loads, seeks } = fixture();
    await engine.playReader({ surah: 1, ayah: 1 });
    expect(loads).toHaveLength(1);
    expect(loads[0]?.seconds).toBe(1);
    await engine.next();
    expect(loads).toHaveLength(1);
    expect(seeks).toEqual([3]);
    expect(engine.snapshot().current).toEqual({ surah: 1, ayah: 2 });
  });
  test('ignores stale async metadata after a new selection', async () => {
    const { engine, provider, audio, loads } = fixture();
    let finish: ((value: SurahAudio) => void) | undefined;
    provider.surah = async (_code, surah) => surah === 1 ? new Promise(resolve => { finish = resolve; }) : { ...audio, url: 'https://cdn.mp3quran.net/audio/mahmoud-husary/r1/002-64k.mp3' };
    const first = engine.playReader({ surah: 1, ayah: 1 });
    await Promise.resolve(); await Promise.resolve();
    await engine.playReader({ surah: 2, ayah: 1 });
    finish?.(audio);
    await first;
    expect(loads).toHaveLength(1);
    expect(loads[0]?.url).toContain('/002-64k.mp3');
    expect(engine.snapshot().current?.surah).toBe(2);
  });
  test('old native events cannot alter a newer source and failures remain visible', async () => {
    const { engine, loads, provider } = fixture();
    await engine.playReader({ surah: 1, ayah: 1 });
    const token = loads[0]?.token ?? 0;
    engine.status({ token: token - 1, seconds: 100, duration: 200, listenedSeconds: 0, playing: true, loading: false, loaded: true, ended: false, error: null, sleepUntil: null });
    expect(engine.snapshot().playing).toBe(false);
    provider.surah = async () => { throw new Error('offline'); };
    await engine.playReader({ surah: 2, ayah: 1 });
    expect(engine.snapshot().error).toBeTruthy();
    expect(engine.snapshot().playing).toBe(false);
  });
  test('sleep belongs to native player and release cancels screen-independent work exactly once', async () => {
    const { engine, sleeps, releases } = fixture();
    await engine.setSleepUntil(12345);
    await engine.setSleepUntil(null);
    expect(sleeps).toEqual([12345, null]);
    await engine.dispose(); await engine.dispose();
    expect(releases()).toBe(1);
  });
  test('retries a failed native item by loading it again rather than seeking an absent player', async () => {
    const { engine, native, loads, seeks } = fixture();
    const load = native.load;
    let first = true;
    native.load = async (...args) => { await load(...args); if (first) { first = false; throw new Error('failed item'); } };
    await engine.playReader({ surah: 1, ayah: 1 });
    expect(engine.snapshot().error).toBeTruthy();
    await engine.toggle();
    expect(loads).toHaveLength(2);
    expect(seeks).toHaveLength(0);
  });
  test('a reciter change during initial buffering restarts intended listening', async () => {
    const { engine, provider, audio, loads } = fixture();
    let finish: ((value: SurahAudio) => void) | undefined;
    provider.surah = async code => code === 'mahmoud-husary/r1' ? new Promise(resolve => { finish = resolve; }) : { ...audio, url: 'https://cdn.mp3quran.net/audio/mishary-alafasy/r1/001-64k.mp3' };
    const old = engine.playReader({ surah: 1, ayah: 1 });
    await Promise.resolve(); await Promise.resolve();
    await engine.setRecitation('mishary-alafasy/r1');
    finish?.(audio); await old;
    expect(loads).toHaveLength(1);
    expect(loads[0]?.url).toContain('mishary-alafasy');
    await engine.stop();
    expect(engine.snapshot().current).toBeNull();
  });
  test('a failed native stop remains visibly active and retryable', async () => {
    const { engine, native } = fixture();
    await engine.playReader({ surah: 1, ayah: 1 });
    native.stop = async () => { throw new Error('native failure'); };
    await expect(engine.stop()).rejects.toThrow();
    expect(engine.snapshot().current).toEqual({ surah: 1, ayah: 1 });
    expect(engine.snapshot().error).toBeTruthy();
  });
  test('native cumulative listening is retained even after stop and cannot regress with a stale playback event', async () => {
    const { engine } = fixture();
    await engine.stop();
    engine.status({ token: 0, seconds: 0, duration: 0, listenedSeconds: 4.5, playing: false, loading: false, loaded: false, ended: false, error: null, sleepUntil: null });
    expect(engine.snapshot().listenedSeconds).toBe(4.5);
    engine.status({ token: 0, seconds: 0, duration: 0, listenedSeconds: 3, playing: false, loading: false, loaded: false, ended: false, error: null, sleepUntil: null });
    expect(engine.snapshot().listenedSeconds).toBe(4.5);
  });
  test('audio starts before optional word text', async () => {
    const { engine, provider, loads } = fixture();
    let resolve: ((value: { words: []; text: Map<number, [number, string, null][]> }) => void) | undefined;
    provider.enrich = async () => new Promise(finish => { resolve = finish; });
    await engine.playReader({ surah: 1, ayah: 1 });
    expect(loads).toHaveLength(1);
    resolve?.({ words: [], text: new Map([[1, [[1, 'بسم', null]]]]) });
    await Promise.resolve(); await Promise.resolve();
    expect(engine.snapshot().words).toEqual(['بسم']);
  });
  test('a pending provider response cannot load audio after explicit stop', async () => {
    const { engine, provider, audio, loads } = fixture();
    let resolve: ((value: SurahAudio) => void) | undefined;
    provider.surah = async () => new Promise(finish => { resolve = finish; });
    const pending = engine.playReader({ surah: 1, ayah: 1 }); await Promise.resolve(); await Promise.resolve();
    await engine.stop(); resolve?.(audio); await pending;
    expect(loads).toHaveLength(0); expect(engine.snapshot().current).toBeNull();
  });
});
