import { create } from 'zustand';
import {
  fetchSurahs, getAyahTimings, getLetterTimings, getSurah, getWordTimings,
  type AyahTiming, type LetterTiming, type V4SurahSummary, type WordTiming,
} from '@/Pages/Muslim/_lib/mp3quran';
import {
  DEFAULT_RECITATION_CODE, SURAH_NAMES_AR, ayahAudioUrl, normalizeRecitationCode,
  recitationByCode,
} from '@/Pages/Muslim/_lib/quran';
import {
  ayahTimingMap, findAyahAt, findLetterAt, findWordAt, pickAudioTier, wordOccurrenceKey,
} from '@/Pages/Muslim/_lib/quranAudio';

// One audio element for the whole app, driven by a zustand store. It lives
// outside React so playback survives route changes: the radio/followed view,
// the Board widget and the Quran reader all bind to the same player.
//
// Playback is continuous per surah file: it seeks only when the user jumps
// (start / next / prev / reciter). The ayah and word timings are read from the
// audio clock to move the highlight — never to cut the audio — so ayah
// boundaries do not stutter, and gaps between ayahs are heard as the reciter
// left them.

export interface PlayerAyah {
  surah: number;
  ayah: number;
}

export interface PlayerActiveWord {
  surah: number;
  ayah: number;
  position: number;
  occurrence: number;
  apiWords: string[] | null;
  letterIndex: number | null;
  letterCount: number | null;
  letterConf: number | null;
}

interface SurahAudio {
  url: string;
  ayahs: Map<number, { start: number; end: number }>;
  /** Raw time-ordered ayah timings, for reading the active ayah. */
  ayahTimings: AyahTiming[];
  words: WordTiming[];
  wordText: Map<number, string[]>;
}

const VOLUME_KEY = 'sz-muslim-volume';
const RECITER_KEY = 'sz-muslim-quran-reciter';

function readVolume(): number {
  if (typeof window === 'undefined') return 1;
  const v = Number(window.localStorage.getItem(VOLUME_KEY) ?? 1);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

function readRecitation(): string {
  if (typeof window === 'undefined') return DEFAULT_RECITATION_CODE;
  return normalizeRecitationCode(window.localStorage.getItem(RECITER_KEY));
}

export interface QuranPlayerState {
  recitationCode: string;
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Progress through the current ayah (0..1). */
  progress: number;
  current: PlayerAyah | null;
  activeWord: PlayerActiveWord | null;
  volume: number;
  muted: boolean;
  /** Who owns the queue: the reader, or the continuous recitation. */
  source: 'reader' | 'continuous' | null;

  setRecitation: (code: string) => void;
  /** Followed recitation: the whole mushaf, surah after surah. */
  playContinuous: (opts?: { recitationCode?: string; start?: PlayerAyah }) => void;
  /** Reader: the whole mushaf starting at an ayah (no page-scoped queue). */
  playReader: (start: PlayerAyah) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  stop: () => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
}

// --- engine state (module singletons, not React state) ----------------------

let audio: HTMLAudioElement | null = null;
let cache = new Map<number, SurahAudio>();
let letterCache = new Map<string, { letters: LetterTiming[]; counts: Map<string, number> }>();
let letterPending = new Set<string>();
let summaries: V4SurahSummary[] | null = null;
let queuePromise: Promise<PlayerAyah[]> | null = null;

let queue: PlayerAyah[] = [];
let index = -1;
let loadedSurah: number | null = null;
let pendingSeek: number | null = null;
let activeWordSnapshot: PlayerActiveWord | null = null;

const useQuranPlayer = create<QuranPlayerState>((set, get) => ({
  recitationCode: readRecitation(),
  playing: false,
  loading: false,
  error: null,
  progress: 0,
  current: null,
  activeWord: null,
  volume: readVolume(),
  muted: false,
  source: null,

  setRecitation: (code) => {
    if (get().recitationCode === code) return;
    cache = new Map();
    letterCache = new Map();
    letterPending = new Set();
    activeWordSnapshot = null;
    set({ recitationCode: code, activeWord: null });
    try {
      window.localStorage.setItem(RECITER_KEY, code);
    } catch {
      /* private mode */
    }
    if (index >= 0 && get().playing && queue[index]) {
      const at = queue[index];
      window.setTimeout(() => playIndex(index, at), 0);
    }
  },

  playContinuous: (opts) => {
    const code = opts?.recitationCode;
    if (code && code !== get().recitationCode) get().setRecitation(code);
    set({ source: 'continuous' });
    void ensureQueue().then((q) => {
      if (q.length === 0) {
        set({ error: 'تعذّر تجهيز قائمة التلاوة — تحقّق من الاتصال.' });
        return;
      }
      const start = opts?.start ?? q[0];
      playIndex(indexOfAyah(q, start), start);
    });
  },

  playReader: (start) => {
    set({ source: 'reader' });
    void ensureQueue().then((q) => {
      if (q.length === 0) {
        set({ error: 'تعذّر تجهيز قائمة التلاوة — تحقّق من الاتصال.' });
        return;
      }
      playIndex(indexOfAyah(q, start), start);
    });
  },

  toggle: () => {
    const el = audio;
    if (!el) {
      if (index >= 0 && queue[index]) playIndex(index, queue[index]);
      return;
    }
    if (get().playing) {
      el.pause();
      return;
    }
    if (index >= 0 && el.src && !el.ended) {
      el.play().then(() => set({ playing: true })).catch(() => set({ playing: false }));
      return;
    }
    if (index >= 0 && queue[index]) playIndex(index, queue[index]);
  },

  next: () => {
    if (index >= 0 && index + 1 < queue.length) playIndex(index + 1, queue[index + 1]);
  },

  prev: () => {
    if (index > 0) playIndex(index - 1, queue[index - 1]);
  },

  stop: () => {
    if (audio) audio.pause();
    index = -1;
    activeWordSnapshot = null;
    set({ playing: false, loading: false, current: null, activeWord: null, progress: 0, source: null });
  },

  setVolume: (v) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (audio) audio.volume = clamped;
    set({ volume: clamped, muted: clamped === 0 });
    try {
      window.localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      /* private mode */
    }
  },

  setMuted: (m) => {
    if (audio) audio.volume = m ? 0 : get().volume;
    set({ muted: m });
  },
}));

// --- audio element + listeners ----------------------------------------------

function ensureAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.volume = useQuranPlayer.getState().muted ? 0 : useQuranPlayer.getState().volume;
    attach(audio);
  }
  return audio;
}

function attach(el: HTMLAudioElement): void {
  el.addEventListener('loadedmetadata', () => {
    const p = pendingSeek;
    pendingSeek = null;
    if (p !== null) seekAndPlay(p);
  });
  el.addEventListener('playing', () => useQuranPlayer.setState({ playing: true, loading: false }));
  el.addEventListener('pause', () => {
    useQuranPlayer.setState({ playing: false });
    activeWordSnapshot = null;
    useQuranPlayer.setState({ activeWord: null });
  });
  el.addEventListener('timeupdate', handleTimeUpdate);
  el.addEventListener('ended', handleEnded);
  el.addEventListener('error', () => {
    activeWordSnapshot = null;
    useQuranPlayer.setState({
      loading: false,
      playing: false,
      activeWord: null,
      error: 'تعذّر تشغيل التلاوة — تحقّق من الاتصال.',
    });
  });

  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    const handlers: Array<[MediaSessionAction, () => void]> = [
      ['play', () => useQuranPlayer.getState().toggle()],
      ['pause', () => useQuranPlayer.getState().toggle()],
      ['nexttrack', () => useQuranPlayer.getState().next()],
      ['previoustrack', () => useQuranPlayer.getState().prev()],
    ];
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    }
  }
}

// --- playback core -----------------------------------------------------------

/** Jump to a queue position: load/seek to the ayah and play. */
function playIndex(i: number, ayah: PlayerAyah): void {
  if (!ayah) return;
  index = i;
  loadedSurah = ayah.surah;
  activeWordSnapshot = null;
  useQuranPlayer.setState({ current: ayah, activeWord: null, error: null, loading: true, progress: 0 });
  updateMediaSession(ayah);
  void loadSurah(ayah.surah).then((entry) => {
    if (index !== i) return;
    if (!entry || entry.ayahs.size === 0) {
      const url = ayahAudioUrl(recitationByCode(useQuranPlayer.getState().recitationCode), ayah.surah, ayah.ayah);
      if (!url) {
        useQuranPlayer.setState({ loading: false, error: 'لا يتوفّر تسجيل صوتي لهذا القارئ.' });
        return;
      }
      playFrom(url, 0);
      return;
    }
    const span = entry.ayahs.get(ayah.ayah);
    playFrom(entry.url, span ? span.start : 0);
  });
}

/** The surah file finished: continue to the next ayah (next surah), or stop. */
function handleEnded(): void {
  if (index >= 0 && index + 1 < queue.length) {
    playIndex(index + 1, queue[index + 1]);
    return;
  }
  useQuranPlayer.setState({ playing: false });
}

function playFrom(url: string, startMs: number): void {
  const el = ensureAudio();
  if (!el) return;
  useQuranPlayer.setState({ error: null, progress: 0 });
  if (el.src !== url) {
    pendingSeek = startMs;
    el.src = url;
    el.load();
    useQuranPlayer.setState({ loading: true });
  } else {
    seekAndPlay(startMs);
  }
}

function seekAndPlay(startMs: number): void {
  const el = audio;
  if (!el) return;
  try {
    el.currentTime = Math.max(0, startMs) / 1000;
  } catch {
    pendingSeek = startMs;
    return;
  }
  el.play()
    .then(() => useQuranPlayer.setState({ playing: true, error: null }))
    .catch(() => useQuranPlayer.setState({ playing: false }));
}

function handleTimeUpdate(): void {
  const el = audio;
  if (!el || loadedSurah === null) return;
  const entry = cache.get(loadedSurah);
  if (!entry) return;
  const t = el.currentTime * 1000;

  // The ayah sounding now, read from the audio clock (no seeking).
  const a = findAyahAt(entry.ayahTimings, t);
  if (a) {
    const ayah = a[0];
    const cur = useQuranPlayer.getState().current;
    if (!cur || cur.surah !== loadedSurah || cur.ayah !== ayah) {
      const next = { surah: loadedSurah, ayah };
      index = indexOfAyah(queue, next);
      useQuranPlayer.setState({ current: next });
      updateMediaSession(next);
    }
    useQuranPlayer.setState({
      progress: a[2] > a[1] ? Math.max(0, Math.min(1, (t - a[1]) / (a[2] - a[1]))) : 0,
    });
  }

  updateActiveWord(t, loadedSurah, entry);
}

function updateActiveWord(t: number, surah: number, entry: SurahAudio): void {
  if (entry.words.length === 0) {
    if (activeWordSnapshot) {
      activeWordSnapshot = null;
      useQuranPlayer.setState({ activeWord: null });
    }
    return;
  }
  const w = findWordAt(entry.words, t);
  let next: PlayerActiveWord | null = null;
  if (w) {
    ensureLetters(surah, w[0]);
    const cached = letterCache.get(`${surah}:${w[0]}`);
    let letterIndex: number | null = null;
    let letterCount: number | null = null;
    let letterConf: number | null = null;
    if (cached) {
      letterCount = cached.counts.get(wordOccurrenceKey(w[0], w[1], w[4])) ?? null;
      const l = findLetterAt(cached.letters, t);
      if (l && l[0] === w[0] && l[1] === w[1] && l[5] === w[4]) {
        letterIndex = l[2];
        letterConf = l[6];
      }
    }
    next = {
      surah,
      ayah: w[0],
      position: w[1],
      occurrence: w[4],
      apiWords: entry.wordText.get(w[0]) ?? null,
      letterIndex,
      letterCount,
      letterConf,
    };
  }
  const prev = activeWordSnapshot;
  const changed =
    !prev !== !next ||
    (prev && next && (
      prev.ayah !== next.ayah ||
      prev.position !== next.position ||
      prev.occurrence !== next.occurrence ||
      prev.letterIndex !== next.letterIndex
    ));
  if (changed) {
    activeWordSnapshot = next;
    useQuranPlayer.setState({ activeWord: next });
  }
}

// --- data loading ------------------------------------------------------------

async function loadSurah(surah: number, signal?: AbortSignal): Promise<SurahAudio | null> {
  const cached = cache.get(surah);
  if (cached) return cached;
  const code = useQuranPlayer.getState().recitationCode;
  try {
    const item = await getSurah(code, surah, signal);
    const url = pickAudioTier(item.files);
    let ayahs = new Map<number, { start: number; end: number }>();
    let ayahTimings: AyahTiming[] = [];
    if (item.timings?.includes('ayah')) {
      try {
        const t = await getAyahTimings(code, surah, {}, signal);
        ayahTimings = t.ayahs;
        ayahs = ayahTimingMap(t.ayahs);
      } catch {
        /* no ayah timings */
      }
    }
    let words: WordTiming[] = [];
    const wordText = new Map<number, string[]>();
    if (item.timings?.includes('word')) {
      try {
        const w = await getWordTimings(code, surah, { include: 'text' }, signal);
        words = w.words ?? [];
        for (const [a, ws] of w.text?.ayahs ?? []) wordText.set(a, ws.map((x) => x[1]));
      } catch {
        /* no word timings */
      }
    }
    if (!url) return null;
    const entry: SurahAudio = { url, ayahs, ayahTimings, words, wordText };
    cache.set(surah, entry);
    return entry;
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') return null;
    return null;
  }
}

function ensureLetters(surah: number, ayah: number): void {
  const key = `${surah}:${ayah}`;
  if (letterCache.has(key) || letterPending.has(key)) return;
  letterPending.add(key);
  const code = useQuranPlayer.getState().recitationCode;
  void getLetterTimings(code, surah, { ayah })
    .then((res) => {
      const counts = new Map<string, number>();
      for (const l of res.letters ?? []) {
        const ck = wordOccurrenceKey(l[0], l[1], l[5]);
        counts.set(ck, Math.max(counts.get(ck) ?? 0, l[2]));
      }
      letterCache.set(key, { letters: res.letters ?? [], counts });
    })
    .catch(() => undefined)
    .finally(() => letterPending.delete(key));
}

/** The whole mushaf as one queue, built once. */
function ensureQueue(): Promise<PlayerAyah[]> {
  if (queue.length > 0) return Promise.resolve(queue);
  if (!queuePromise) {
    queuePromise = (async () => {
      if (!summaries) {
        try {
          summaries = await fetchSurahs();
        } catch {
          summaries = null;
        }
      }
      if (!summaries) return [];
      const out: PlayerAyah[] = [];
      for (const s of summaries) {
        for (let a = 1; a <= s.ayah_count; a += 1) out.push({ surah: s.number, ayah: a });
      }
      queue = out;
      return out;
    })();
  }
  return queuePromise;
}

function indexOfAyah(list: PlayerAyah[], ayah: PlayerAyah): number {
  const found = list.findIndex((a) => a.surah === ayah.surah && a.ayah === ayah.ayah);
  return found >= 0 ? found : 0;
}

function updateMediaSession(ayah: PlayerAyah): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const rec = recitationByCode(useQuranPlayer.getState().recitationCode);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${SURAH_NAMES_AR[ayah.surah] ?? ayah.surah} · آية ${ayah.ayah}`,
      artist: rec.nameAr,
      album: 'تلاوة القرآن',
    });
  } catch {
    /* MediaMetadata unsupported */
  }
}

export { useQuranPlayer };
