import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getAyahTimings, getLetterTimings, getSurah, getWordTimings,
  type LetterTiming, type WordTiming,
} from './mp3quran';
import { ayahAudioUrl, type Ayah, type Recitation } from './quran';
import { ayahTimingMap, findLetterAt, findWordAt, pickAudioTier, wordOccurrenceKey } from './quranAudio';

/** One surah's playable file + its ayah/word timings, for the current recitation. */
interface SurahAudio {
  url: string;
  ayahs: Map<number, { start: number; end: number }>;
  words: WordTiming[];
  /** Ayah number → rasm_uthmani of each word, by word position order. */
  wordText: Map<number, string[]>;
}

export interface ActiveWord {
  surah: number;
  ayah: number;
  /** 1-based word position inside the ayah. */
  position: number;
  occurrence: number;
  /** API word texts of the ayah, for aligning to the local mushaf. */
  apiWords: string[] | null;
  /** 1-based letter sounding inside the word, when letter timings exist. */
  letterIndex: number | null;
  /** Letters in the word (for the letter sweep). */
  letterCount: number | null;
  /** Model confidence for the active letter; null for a silent letter. */
  letterConf: number | null;
}

export interface UseSurahAudioOptions {
  /** Ayahs visible in the reader (the playback queue). */
  ayahs: Ayah[];
  recitation: Recitation;
  currentKey: string | null;
  /** Incremented by a tap on the Ayah text to start playback. */
  playSignal: number;
  onSelectAyah: (key: string) => void;
  onEndOfList?: () => void;
}

export interface SurahAudioProps {
  ref: React.RefObject<HTMLAudioElement | null>;
  preload: string;
  onLoadedMetadata: () => void;
  onSeeked: () => void;
  onPlaying: () => void;
  onPause: () => void;
  onTimeUpdate: () => void;
  onEnded: () => void;
  onError: () => void;
}

export interface UseSurahAudio {
  playing: boolean;
  loading: boolean;
  error: string | null;
  /** Progress through the current ayah (0..1). */
  progress: number;
  /** The word being recited right now, or null between words / when paused. */
  activeWord: ActiveWord | null;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  audioProps: SurahAudioProps;
}

/**
 * Per-surah streaming engine on the v4 API: one file per surah, seeked to the
 * ayah's `start_ms` and advanced at `end_ms` from the ayah timings, so moving
 * between ayahs of the same surah is a gapless in-file seek. Falls back to
 * per-ayah EveryAyah files when a recitation/surah has no v4 timings.
 */
export function useSurahAudio(opts: UseSurahAudioOptions): UseSurahAudio {
  const { recitation, playSignal } = opts;
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [activeWord, setActiveWord] = useState<ActiveWord | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const live = useRef(opts);
  live.current = opts;

  const cacheRef = useRef<Map<number, SurahAudio>>(new Map());
  const indexRef = useRef(-1);
  const currentSurahRef = useRef<number | null>(null);
  const ayahStartRef = useRef(0);
  const playEndRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const advancingRef = useRef(false);
  const activeWordSnapshot = useRef<ActiveWord | null>(null);
  // Letter timings are loaded per ayah, on demand (they are ~4x the word data).
  const letterCacheRef = useRef<Map<string, { letters: LetterTiming[]; counts: Map<string, number> }>>(new Map());
  const letterPendingRef = useRef<Set<string>>(new Set());

  const clearAdvance = () => {
    if (advanceRef.current !== null) {
      window.clearTimeout(advanceRef.current);
      advanceRef.current = null;
    }
  };

  const loadSurah = useCallback(
    async (surah: number, signal?: AbortSignal): Promise<SurahAudio | null> => {
      const cached = cacheRef.current.get(surah);
      if (cached) return cached;
      try {
        const item = await getSurah(recitation.code, surah, signal);
        const url = pickAudioTier(item.files);
        let ayahs = new Map<number, { start: number; end: number }>();
        if (item.timings?.includes('ayah')) {
          try {
            const t = await getAyahTimings(recitation.code, surah, {}, signal);
            ayahs = ayahTimingMap(t.ayahs);
          } catch {
            // timings unavailable: fall through to the per-ayah fallback
          }
        }
        let words: WordTiming[] = [];
        const wordText = new Map<number, string[]>();
        if (item.timings?.includes('word')) {
          try {
            const w = await getWordTimings(recitation.code, surah, { include: 'text' }, signal);
            words = w.words ?? [];
            for (const [a, ws] of w.text?.ayahs ?? []) wordText.set(a, ws.map((x) => x[1]));
          } catch {
            // word timings unavailable: ayah-level highlight only
          }
        }
        if (!url) return null;
        const entry: SurahAudio = { url, ayahs, words, wordText };
        cacheRef.current.set(surah, entry);
        return entry;
      } catch (e) {
        if ((e as { name?: string })?.name === 'AbortError') return null;
        return null;
      }
    },
    [recitation.code],
  );

  // A stable key for "the surahs on this page", so prefetch does not re-run on
  // every render from a fresh `ayahs` array identity.
  const audioKey = useMemo(() => opts.ayahs.map((a) => a.key).join(','), [opts.ayahs]);

  // Prefetch the v4 file + timings for every surah visible on the page.
  useEffect(() => {
    const ctrl = new AbortController();
    const surahs = [...new Set(live.current.ayahs.map((a) => a.surah))];
    for (const s of surahs) void loadSurah(s, ctrl.signal);
    return () => ctrl.abort();
  }, [audioKey, loadSurah]);

  // Switching reciter drops the cache; if we were playing, reload the ayah.
  useEffect(() => {
    cacheRef.current.clear();
    letterCacheRef.current.clear();
    letterPendingRef.current.clear();
    activeWordSnapshot.current = null;
    setActiveWord(null);
    if (indexRef.current >= 0 && playing) {
      const i = indexRef.current;
      window.setTimeout(() => apiRef.current.playIndex(i), 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recitation.code]);

  const seekAndPlay = (startMs: number) => {
    const el = audioRef.current;
    if (!el) return;
    advancingRef.current = false;
    try {
      el.currentTime = Math.max(0, startMs) / 1000;
    } catch {
      // metadata not ready yet; onLoadedMetadata will retry via pendingSeek
      pendingSeekRef.current = startMs;
      return;
    }
    el.play()
      .then(() => {
        setPlaying(true);
        setError(null);
      })
      .catch(() => setPlaying(false));
  };

  const playFrom = (url: string, startMs: number, endMs: number) => {
    const el = audioRef.current;
    if (!el) return;
    ayahStartRef.current = startMs;
    playEndRef.current = endMs;
    setError(null);
    setProgress(0);
    if (el.src !== url) {
      pendingSeekRef.current = startMs;
      el.src = url;
      el.load();
      setLoading(true);
    } else {
      seekAndPlay(startMs);
    }
  };

  const playIndex = (i: number) => {
    const s = live.current;
    const ayah = s.ayahs[i];
    if (!ayah) return;
    indexRef.current = i;
    currentSurahRef.current = ayah.surah;
    activeWordSnapshot.current = null;
    setActiveWord(null);
    s.onSelectAyah(ayah.key);
    setError(null);
    setLoading(true);
    void loadSurah(ayah.surah).then((entry) => {
      // The selection may have moved on while the surah was loading.
      if (indexRef.current !== i) return;
      const cur = live.current;
      if (!entry || entry.ayahs.size === 0) {
        // No v4 file/timings: fall back to the per-ayah EveryAyah source.
        const url = ayahAudioUrl(cur.recitation, ayah.surah, ayah.ayah);
        if (!url) {
          setLoading(false);
          setError('لا يتوفّر تسجيل صوتي لهذا القارئ.');
          return;
        }
        playFrom(url, 0, Number.POSITIVE_INFINITY);
        return;
      }
      const span = entry.ayahs.get(ayah.ayah);
      if (span) playFrom(entry.url, span.start, span.end);
      else playFrom(entry.url, 0, Number.POSITIVE_INFINITY);
    });
  };

  const advance = () => {
    if (advancingRef.current) return;
    advancingRef.current = true;
    clearAdvance();
    const i = indexRef.current;
    const s = live.current;
    if (i < 0) {
      advancingRef.current = false;
      return;
    }
    if (i + 1 < s.ayahs.length) playIndex(i + 1);
    else if (s.onEndOfList) s.onEndOfList();
    else {
      advancingRef.current = false;
      setPlaying(false);
    }
  };

  const armAdvance = () => {
    clearAdvance();
    const el = audioRef.current;
    if (!el) return;
    const end = playEndRef.current;
    if (!Number.isFinite(end)) return;
    const remaining = end - el.currentTime * 1000;
    advanceRef.current = window.setTimeout(advance, Math.max(0, remaining));
  };

  const handleLoadedMetadata = () => {
    const pending = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (pending !== null) seekAndPlay(pending);
  };

  // Letter timings for one ayah, fetched once and cached (they are large).
  const ensureLetters = (surah: number, ayah: number) => {
    const key = `${surah}:${ayah}`;
    if (letterCacheRef.current.has(key) || letterPendingRef.current.has(key)) return;
    letterPendingRef.current.add(key);
    void getLetterTimings(recitation.code, surah, { ayah })
      .then((res) => {
        const counts = new Map<string, number>();
        for (const l of res.letters ?? []) {
          const ck = wordOccurrenceKey(l[0], l[1], l[5]);
          counts.set(ck, Math.max(counts.get(ck) ?? 0, l[2]));
        }
        letterCacheRef.current.set(key, { letters: res.letters ?? [], counts });
      })
      .catch(() => undefined)
      .finally(() => letterPendingRef.current.delete(key));
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const t = el.currentTime * 1000;

    // Word-level karaoke + letter-level sweep from the timing data.
    const surah = currentSurahRef.current;
    if (surah !== null) {
      const entry = cacheRef.current.get(surah);
      if (entry && entry.words.length > 0) {
        const w = findWordAt(entry.words, t);
        let next: ActiveWord | null = null;
        if (w) {
          ensureLetters(surah, w[0]);
          const cached = letterCacheRef.current.get(`${surah}:${w[0]}`);
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
        const prev = activeWordSnapshot.current;
        const changed =
          !prev !== !next ||
          (prev && next && (
            prev.ayah !== next.ayah ||
            prev.position !== next.position ||
            prev.occurrence !== next.occurrence ||
            prev.letterIndex !== next.letterIndex
          ));
        if (changed) {
          activeWordSnapshot.current = next;
          setActiveWord(next);
        }
      } else if (activeWordSnapshot.current) {
        activeWordSnapshot.current = null;
        setActiveWord(null);
      }
    }

    const start = ayahStartRef.current;
    const end = playEndRef.current;
    if (Number.isFinite(end) && end > start) {
      setProgress(Math.max(0, Math.min(1, (t - start) / (end - start))));
      if (t >= end - 25) {
        advance();
        return;
      }
      // Re-arm against the audio clock so the timer cannot drift.
      armAdvance();
    } else if (el.duration > 0) {
      setProgress(el.currentTime / el.duration);
    }
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      return;
    }
    if (indexRef.current >= 0 && el.src && !el.ended) {
      el.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
      return;
    }
    const s = live.current;
    const i = Math.max(0, s.ayahs.findIndex((a) => a.key === s.currentKey));
    if (s.ayahs.length > 0) playIndex(i);
  };

  const next = () => {
    const i = indexRef.current;
    if (i >= 0 && i + 1 < live.current.ayahs.length) playIndex(i + 1);
  };

  const prev = () => {
    const i = indexRef.current;
    if (i > 0) playIndex(i - 1);
  };

  // Audio event handlers read the latest closures through this ref.
  const apiRef = useRef({ playIndex, seekAndPlay, advance, armAdvance, handleLoadedMetadata, handleTimeUpdate });
  apiRef.current = { playIndex, seekAndPlay, advance, armAdvance, handleLoadedMetadata, handleTimeUpdate };

  // A tap on the Ayah text starts playback from the current selection.
  const lastSignal = useRef(0);
  useEffect(() => {
    if (playSignal > lastSignal.current) {
      lastSignal.current = playSignal;
      const s = live.current;
      if (s.ayahs.length > 0) {
        const i = Math.max(0, s.ayahs.findIndex((a) => a.key === s.currentKey));
        apiRef.current.playIndex(i);
      }
    }
  });

  const audioProps: SurahAudioProps = {
    ref: audioRef,
    preload: 'none',
    onLoadedMetadata: () => apiRef.current.handleLoadedMetadata(),
    onSeeked: () => apiRef.current.armAdvance(),
    onPlaying: () => {
      setPlaying(true);
      setLoading(false);
      apiRef.current.armAdvance();
    },
    onPause: () => {
      setPlaying(false);
      clearAdvance();
      activeWordSnapshot.current = null;
      setActiveWord(null);
    },
    onTimeUpdate: () => apiRef.current.handleTimeUpdate(),
    onEnded: () => apiRef.current.advance(),
    onError: () => {
      setLoading(false);
      setPlaying(false);
      activeWordSnapshot.current = null;
      setActiveWord(null);
      setError('تعذّر تشغيل التلاوة — تحقّق من الاتصال.');
    },
  };

  return { playing, loading, error, progress, activeWord, toggle, next, prev, audioProps };
}
