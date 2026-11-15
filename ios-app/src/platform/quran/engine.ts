import type { QuranProvider, SurahAudio } from './provider';
import { ayahCounts, defaultRecitationCode, findAyahAt, findLetterAt, findWordAt, normalizeRecitationCode, recitationByCode, surahNames, wordOccurrenceKey, type LetterTiming, type TextWord } from './source-rules';

export interface PlayerAyah { surah: number; ayah: number }
export interface ActiveWord extends PlayerAyah { position: number; occurrence: number; apiWords: string[] | null; letterIndex: number | null; letterCount: number | null; letterConf: number | null }
export interface PlayerSnapshot {
  recitationCode: string; playing: boolean; loading: boolean; error: string | null; progress: number;
  current: PlayerAyah | null; activeWord: ActiveWord | null; words: string[]; text: ReadonlyMap<number, TextWord[]>;
  volume: number; muted: boolean; source: 'reader' | 'continuous' | null; sleepUntil: number | null; listenedSeconds: number;
}
export interface NativeAudioStatus { token: number; seconds: number; duration: number; listenedSeconds: number; playing: boolean; loading: boolean; loaded: boolean; ended: boolean; error: string | null; sleepUntil: number | null }
export interface NativeAudioPort {
  load(url: string, seconds: number, token: number): Promise<void>;
  play(): Promise<void>; pause(): Promise<void>; stop(): Promise<void>;
  seek(seconds: number, token: number): Promise<void>;
  volume(value: number, muted: boolean): Promise<void>;
  sleep(until: number | null): Promise<void>;
  metadata(title: string, artist: string): Promise<void>;
  release(): Promise<void>;
}
export interface PlayerPreferences { recitationCode: string; volume: number }
export function createQuranEngine(native: NativeAudioPort, provider: QuranProvider, save?: (preferences: PlayerPreferences) => Promise<void>) {
  let state: PlayerSnapshot = { recitationCode: defaultRecitationCode, playing: false, loading: false, error: null, progress: 0,
    current: null, activeWord: null, words: [], text: new Map(), volume: 1, muted: false, source: null, sleepUntil: null, listenedSeconds: 0 };
  let token = 0, disposed = false, loadedUrl: string | null = null, entry: SurahAudio | null = null, ended = false;
  let request: AbortController | null = null;
  const cache = new Map<string, SurahAudio>(), letters = new Map<string, LetterTiming[]>(), pendingLetters = new Set<string>();
  const letterCounts = new Map<string, Map<string, number>>();
  const subscribers = new Set<() => void>();
  const snapshot = (): PlayerSnapshot => state;
  function publish(patch: Partial<PlayerSnapshot>): void {
    if (disposed) return;
    state = { ...state, ...patch }; subscribers.forEach(callback => callback());
  }
  function valid(ayah: PlayerAyah): boolean { return Number.isInteger(ayah.surah) && ayah.surah >= 1 && ayah.surah <= 114 && Number.isInteger(ayah.ayah) && ayah.ayah >= 1 && ayah.ayah <= (ayahCounts[ayah.surah] ?? 0); }
  function metadata(): void {
    if (!state.current) return;
    void native.metadata(`${surahNames[state.current.surah] ?? state.current.surah} · آية ${state.current.ayah}`, recitationByCode(state.recitationCode).nameAr)
      .catch(() => publish({ error: 'تعذر تحديث بيانات التلاوة.' }));
  }
  function persist(): void {
    if (save) void save({ recitationCode: state.recitationCode, volume: state.volume }).catch(() => publish({ error: 'تعذر حفظ إعداد التلاوة على الجهاز.' }));
  }
  async function start(ayah: PlayerAyah, source: 'reader' | 'continuous'): Promise<void> {
    if (disposed) return;
    if (!valid(ayah)) { publish({ error: 'موضع التلاوة غير صالح.' }); return; }
    const ownToken = ++token, code = state.recitationCode;
    request?.abort(); request = new AbortController();
    const signal = request.signal;
    ended = false;
    publish({ current: ayah, source, loading: true, playing: false, error: null, activeWord: null, progress: 0, words: [], text: new Map() });
    try {
      await native.pause();
      const key = `${code}:${ayah.surah}`;
      const loaded = cache.get(key) ?? await provider.surah(code, ayah.surah, ayah.ayah, signal);
      if (ownToken !== token || signal.aborted || disposed) return;
      if (!loaded.fallback) cache.set(key, loaded);
      entry = loaded;
      const seconds = (loaded.ayahs.find(row => row[0] === ayah.ayah)?.[1] ?? 0) / 1000;
      publish({ words: loaded.text.get(ayah.ayah)?.map(row => row[1]) ?? [], text: loaded.text });
      await native.volume(state.volume, state.muted);
      if (ownToken !== token || disposed) return;
      if (loadedUrl === loaded.url && !loaded.fallback) {
        await native.seek(seconds, ownToken);
        if (ownToken === token && !disposed) await native.play();
      } else {
        loadedUrl = loaded.url;
        await native.load(loaded.url, seconds, ownToken);
      }
      if (ownToken === token) metadata();
      if (provider.enrich && (!loaded.text.size || !loaded.words.length)) void provider.enrich(code, ayah.surah, signal).then(extra => {
        if (ownToken !== token || signal.aborted || disposed) return;
        const enriched = { ...loaded, words: loaded.fallback ? [] : extra.words, text: extra.text };
        entry = enriched;
        if (!loaded.fallback) cache.set(key, enriched);
        publish({ text: enriched.text, words: enriched.text.get(state.current?.ayah ?? ayah.ayah)?.map(row => row[1]) ?? [] });
      }).catch(() => undefined);
    } catch {
      if (ownToken === token && !signal.aborted && !disposed) {
        loadedUrl = null; entry = null;
        publish({ loading: false, playing: false, error: 'تعذر تشغيل التلاوة. تحقق من الاتصال ثم حاول مجدداً.' });
      }
    }
  }
  function neighbor(direction: 1 | -1): PlayerAyah | null {
    const current = state.current;
    if (!current) return null;
    const ayah = current.ayah + direction;
    if (ayah >= 1 && ayah <= (ayahCounts[current.surah] ?? 0)) return { surah: current.surah, ayah };
    const surah = current.surah + direction;
    return surah >= 1 && surah <= 114 ? { surah, ayah: direction > 0 ? 1 : ayahCounts[surah] ?? 1 } : null;
  }
  async function next(): Promise<void> { const at = neighbor(1); if (at && state.source) await start(at, state.source); }
  async function prev(): Promise<void> { const at = neighbor(-1); if (at && state.source) await start(at, state.source); }
  function loadLetters(current: PlayerAyah): void {
    const key = `${state.recitationCode}:${current.surah}:${current.ayah}`;
    if (letters.has(key) || pendingLetters.has(key)) return;
    pendingLetters.add(key);
    const signal = request?.signal ?? new AbortController().signal;
    void provider.letters(state.recitationCode, current.surah, current.ayah, signal).then(rows => {
      if (signal.aborted) return;
      letters.set(key, rows);
      const counts = new Map<string, number>();
      for (const row of rows) { const word = wordOccurrenceKey(row[0], row[1], row[5]); counts.set(word, Math.max(counts.get(word) ?? 0, row[2])); }
      letterCounts.set(key, counts);
    })
      .catch(() => undefined).finally(() => pendingLetters.delete(key));
  }
  function status(value: NativeAudioStatus): void {
    if (disposed) return;
    const listenedSeconds = Number.isFinite(value.listenedSeconds) ? Math.max(state.listenedSeconds, value.listenedSeconds) : state.listenedSeconds;
    if (value.token !== token || !state.current) { if (listenedSeconds !== state.listenedSeconds) publish({ listenedSeconds }); return; }
    const time = value.seconds * 1000, audio = entry;
    const row = audio ? findAyahAt(audio.ayahs, time) : null;
    const current = row ? { surah: state.current.surah, ayah: row[0] } : state.current;
    let activeWord: ActiveWord | null = null;
    const word = audio ? findWordAt(audio.words, time) : null;
    if (word) {
      loadLetters(current);
      const letterKey = `${state.recitationCode}:${current.surah}:${word[0]}`, timings = letters.get(letterKey) ?? [];
      const letter = findLetterAt(timings, time);
      const count = letterCounts.get(letterKey)?.get(wordOccurrenceKey(word[0], word[1], word[4])) ?? 0;
      const matches = letter && letter[0] === word[0] && letter[1] === word[1] && letter[5] === word[4];
      activeWord = { surah: current.surah, ayah: word[0], position: word[1], occurrence: word[4], apiWords: audio?.text.get(word[0])?.map(item => item[1]) ?? null,
        letterIndex: matches ? letter[2] : null, letterCount: count || null, letterConf: matches ? letter[6] : null };
    }
    const changedAyah = state.current.ayah !== current.ayah;
    ended = value.ended;
    publish({ current, words: audio?.text.get(current.ayah)?.map(item => item[1]) ?? [], activeWord,
      playing: value.playing, loading: value.loading, error: value.error, sleepUntil: value.sleepUntil, listenedSeconds,
      progress: row && row[2] > row[1] ? Math.max(0, Math.min(1, (time - row[1]) / (row[2] - row[1]))) : value.duration > 0 ? Math.min(1, value.seconds / value.duration) : 0 });
    if (value.error) { loadedUrl = null; entry = null; }
    if (changedAyah) metadata();
    if (value.ended && state.source) {
      if (audio?.fallback) void next();
      else if (current.surah < 114) void start({ surah: current.surah + 1, ayah: 1 }, state.source);
    }
  }
  return {
    snapshot,
    subscribe(callback: () => void): () => void { subscribers.add(callback); return () => { subscribers.delete(callback); }; },
    initialize(preferences: PlayerPreferences): void {
      if (!state.current) publish({ recitationCode: normalizeRecitationCode(preferences.recitationCode), volume: Math.min(1, Math.max(0, preferences.volume)) });
    },
    reportError(message: string): void { publish({ error: message }); },
    status,
    remote(action: string, eventToken: number): void {
      if (disposed || eventToken !== token) return;
      if (action === 'next') void next();
      if (action === 'previous') void prev();
    },
    async setRecitation(code: string): Promise<void> {
      const normalized = normalizeRecitationCode(code);
      if (normalized === state.recitationCode) return;
      const wasPlaying = state.playing || state.loading, current = state.current, source = state.source;
      const ownToken = ++token;
      request?.abort(); cache.clear(); letters.clear(); letterCounts.clear(); pendingLetters.clear(); loadedUrl = null; entry = null;
      await native.pause();
      if (ownToken !== token || disposed) return;
      publish({ recitationCode: normalized, playing: false, activeWord: null, words: [], text: new Map(), loading: false }); persist();
      if (wasPlaying && current && source) await start(current, source);
    },
    async playContinuous(options?: { recitationCode?: string; start?: PlayerAyah }): Promise<void> {
      if (options?.recitationCode) publish({ recitationCode: normalizeRecitationCode(options.recitationCode) });
      await start(options?.start ?? { surah: 1, ayah: 1 }, 'continuous');
    },
    playReader: (startAt: PlayerAyah): Promise<void> => start(startAt, 'reader'),
    async toggle(): Promise<void> {
      try {
        if (state.playing) await native.pause();
        else if (state.current && state.source && (ended || !entry)) await start(state.current, state.source);
        else if (state.current) await native.play();
      } catch { publish({ error: 'تعذر التحكم بالتلاوة. حاول مجدداً.' }); }
    },
    next, prev,
    async stop(): Promise<void> {
      const previousToken = token, ownToken = ++token;
      request?.abort();
      try {
        await native.stop();
        if (ownToken !== token) return;
        loadedUrl = null; entry = null;
        publish({ current: null, source: null, playing: false, loading: false, activeWord: null, progress: 0, sleepUntil: null });
      } catch (reason) {
        if (ownToken === token) { token = previousToken; publish({ loading: false, error: 'تعذر إيقاف التلاوة. أعد المحاولة.' }); }
        throw reason;
      }
    },
    async setVolume(volume: number): Promise<void> {
      if (!Number.isFinite(volume)) return;
      const value = Math.max(0, Math.min(1, volume));
      await native.volume(value, value === 0); publish({ volume: value, muted: value === 0 }); persist();
    },
    async setMuted(muted: boolean): Promise<void> { await native.volume(state.volume, muted); publish({ muted }); },
    async setSleepUntil(until: number | null): Promise<void> {
      if (until !== null && (!Number.isFinite(until) || until < 0)) throw new Error('موعد الإيقاف غير صالح.');
      await native.sleep(until); publish({ sleepUntil: until });
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true; ++token; request?.abort(); subscribers.clear(); await native.release();
    }
  };
}
export type QuranEngine = ReturnType<typeof createQuranEngine>;

// PORT STATUS: source resources/js/Domain/quran/quranPlayer.ts; confidence medium; todos 0.
