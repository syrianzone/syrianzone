import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAyahTimings, getSurah } from './mp3quran';
import { ayahAudioUrl, type Ayah, type Recitation } from './quran';
import { ayahTimingMap, pickAudioTier } from './quranAudio';

/** One surah's playable file + its ayah spans, for the current recitation. */
interface SurahAudio {
  url: string;
  ayahs: Map<number, { start: number; end: number }>;
}

export interface UseSurahAudioOptions {
  /** Ayahs visible in the reader (the playback queue). */
  ayat: Ayah[];
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const live = useRef(opts);
  live.current = opts;

  const cacheRef = useRef<Map<number, SurahAudio>>(new Map());
  const indexRef = useRef(-1);
  const ayahStartRef = useRef(0);
  const playEndRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const advanceRef = useRef<number | null>(null);
  const advancingRef = useRef(false);

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
        if (!url) return null;
        const entry: SurahAudio = { url, ayahs };
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
  // every render from a fresh `ayat` array identity.
  const audioKey = useMemo(() => opts.ayat.map((a) => a.key).join(','), [opts.ayat]);

  // Prefetch the v4 file + timings for every surah visible on the page.
  useEffect(() => {
    const ctrl = new AbortController();
    const surahs = [...new Set(live.current.ayat.map((a) => a.surah))];
    for (const s of surahs) void loadSurah(s, ctrl.signal);
    return () => ctrl.abort();
  }, [audioKey, loadSurah]);

  // Switching reciter drops the cache; if we were playing, reload the ayah.
  useEffect(() => {
    cacheRef.current.clear();
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
    const ayah = s.ayat[i];
    if (!ayah) return;
    indexRef.current = i;
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
    if (i + 1 < s.ayat.length) playIndex(i + 1);
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

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    const t = el.currentTime * 1000;
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
    const i = Math.max(0, s.ayat.findIndex((a) => a.key === s.currentKey));
    if (s.ayat.length > 0) playIndex(i);
  };

  const next = () => {
    const i = indexRef.current;
    if (i >= 0 && i + 1 < live.current.ayat.length) playIndex(i + 1);
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
      if (s.ayat.length > 0) {
        const i = Math.max(0, s.ayat.findIndex((a) => a.key === s.currentKey));
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
    },
    onTimeUpdate: () => apiRef.current.handleTimeUpdate(),
    onEnded: () => apiRef.current.advance(),
    onError: () => {
      setLoading(false);
      setPlaying(false);
      setError('تعذّر تشغيل التلاوة — تحقّق من الاتصال.');
    },
  };

  return { playing, loading, error, progress, toggle, next, prev, audioProps };
}
