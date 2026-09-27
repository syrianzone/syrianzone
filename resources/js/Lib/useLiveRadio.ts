// Live-stream playback core shared by every Quran radio surface (the Muslim
// corner applet and the Board widget).
//
// A live stream has no duration and no seek range, so this hook deliberately
// exposes no progress or seek API: playback state, transport, volume, and a
// bounded skip-past-dead-station recovery are the whole surface.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  claimLiveStream,
  releaseLiveStream,
  useQuranRadioStations,
  type QuranRadioStation,
} from './quranRadio';

const VOLUME_KEY = 'sz-muslim-volume';
/** Consecutive stations tried before giving up on the current list. */
const MAX_ERROR_SKIPS = 5;

function readStoredVolume(): number {
  try {
    const v = Number(window.localStorage.getItem(VOLUME_KEY) ?? 0.8);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
  } catch {
    return 0.8;
  }
}

export interface UseLiveRadio {
  stations: QuranRadioStation[];
  isListLoading: boolean;
  isFallbackList: boolean;
  reloadStations: () => void;
  station: QuranRadioStation | null;
  selectStation: (id: number) => void;
  next: () => void;
  prev: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  /** Arabic message for the current failure, or null when healthy. */
  error: string | null;
  hasStarted: boolean;
  volume: number;
  isMuted: boolean;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  toggle: () => void;
  pause: () => void;
  retry: () => void;
  /** Spread onto the one <audio> element: `<audio {...radio.audioProps} />`. */
  audioProps: LiveRadioAudioProps;
}

export interface LiveRadioAudioProps {
  ref: React.RefObject<HTMLAudioElement | null>;
  preload: string;
  onWaiting: () => void;
  onCanPlay: () => void;
  onPlaying: () => void;
  onError: () => void;
}

export function useLiveRadio(): UseLiveRadio {
  const { stations, isLoading: isListLoading, isFallback: isFallbackList, reload } = useQuranRadioStations();
  const [stationId, setStationId] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const skipBudget = useRef(MAX_ERROR_SKIPS);
  // Set by the error handler so the station effect restarts playback.
  const resumeRef = useRef(false);
  // "The user wants sound", tracked apart from isPlaying: a stream that dies
  // flips isPlaying off through the failed play() promise, sometimes before
  // the error event arrives, and recovery must not depend on that race.
  const intentRef = useRef(false);

  // The list arrives after the first paint, so resolve the current station
  // from whatever is loaded and fall back to the first entry.
  const station = stations.find((s) => s.id === stationId) ?? stations[0] ?? null;

  useEffect(() => {
    if (stationId === null && stations.length > 0) setStationId(stations[0].id);
  }, [stations, stationId]);

  useEffect(() => {
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      /* private mode: volume just will not persist */
    }
  }, [volume]);

  const start = useCallback((el: HTMLAudioElement, url: string) => {
    claimLiveStream(el);
    setIsLoading(true);
    setError(null);
    el.play()
      .then(() => {
        setIsPlaying(true);
        setHasStarted(true);
      })
      .catch(() => {
        // A rejection belonging to a station we have already left (the error
        // recovery advances while this promise is still settling) must not
        // stop the station we moved on to.
        if (el.src !== url) return;
        setIsPlaying(false);
      })
      .finally(() => {
        if (el.src === url) setIsLoading(false);
      });
  }, []);

  const pause = useCallback((el: HTMLAudioElement) => {
    el.pause();
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  /** Pause from outside (the sleep timer fires this). */
  const pausePlayback = useCallback(() => {
    intentRef.current = false;
    const el = audioRef.current;
    if (el) pause(el);
  }, [pause]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el || !station) return;
    setHasStarted(true);
    if (el.paused) {
      intentRef.current = true;
      if (el.src !== station.url) el.src = station.url;
      el.volume = isMuted ? 0 : volume;
      start(el, station.url);
    } else {
      intentRef.current = false;
      pause(el);
    }
  }, [isMuted, pause, start, station, volume]);

  const retry = useCallback(() => {
    const el = audioRef.current;
    if (!el || !station) return;
    skipBudget.current = MAX_ERROR_SKIPS;
    setError(null);
    intentRef.current = true;
    el.src = station.url;
    el.load();
    start(el, station.url);
  }, [start, station]);

  const move = useCallback((delta: number, keepErrorBudget = false) => {
    setStationId((current) => {
      const from = stations.findIndex((s) => s.id === current);
      const base = from === -1 ? 0 : from;
      const nextIndex = (base + delta + stations.length) % stations.length;
      return stations[nextIndex]?.id ?? current;
    });
    // A station the user picked deserves a fresh error budget; a station we
    // skipped to because it was dead must keep drawing on the current one.
    if (!keepErrorBudget) skipBudget.current = MAX_ERROR_SKIPS;
    setError(null);
  }, [stations]);

  const next = useCallback(() => move(1), [move]);
  const prev = useCallback(() => move(-1), [move]);

  const selectStation = useCallback((id: number) => {
    setStationId(id);
    skipBudget.current = MAX_ERROR_SKIPS;
    setError(null);
  }, []);

  const setVolume = useCallback((value: number) => {
    const clamped = Math.min(1, Math.max(0, value));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((muted) => {
      const nextMuted = !muted;
      if (audioRef.current) audioRef.current.volume = nextMuted ? 0 : volume;
      return nextMuted;
    });
  }, [volume]);

  // Point the element at the selected station, and keep it playing if it was.
  // `resumeRef` carries the error recovery, which must restart playback even
  // when `isPlaying` has already been flipped back to false by the rejection
  // of the dead station's own play() call.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !station) return;
    if (el.src !== station.url) el.src = station.url;
    el.volume = isMuted ? 0 : volume;
    if (isPlaying || resumeRef.current) {
      resumeRef.current = false;
      start(el, station.url);
    }
  }, [isMuted, isPlaying, start, station, volume]);

  // A stream can die mid-playback (the list is not maintained upstream). Walk
  // forward through a few neighbours, staying in the playing state, rather
  // than stranding the user on silence.
  const handleError = useCallback(() => {
    const el = audioRef.current;
    const wanted = intentRef.current;
    if (el) {
      el.pause();
      releaseLiveStream(el);
    }
    setIsLoading(false);

    if (wanted && skipBudget.current > 0 && stations.length > 1) {
      skipBudget.current -= 1;
      setError('تعذّر البث — جارٍ تجربة إذاعة أخرى…');
      resumeRef.current = true;
      move(1, true);
      return;
    }

    intentRef.current = false;
    setIsPlaying(false);
    setError('تعذّر تشغيل هذه الإذاعة — جرّب إذاعة أخرى');
  }, [move, stations.length]);

  useEffect(() => () => releaseLiveStream(audioRef.current), []);

  const audioProps: LiveRadioAudioProps = {
    ref: audioRef,
    preload: 'none',
    onWaiting: () => setIsLoading(true),
    onCanPlay: () => setIsLoading(false),
    onPlaying: () => setIsPlaying(true),
    onError: handleError,
  };

  return {
    stations,
    isListLoading,
    isFallbackList,
    reloadStations: reload,
    station,
    selectStation,
    next,
    prev,
    isPlaying,
    isLoading,
    error,
    hasStarted,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    toggle,
    pause: pausePlayback,
    retry,
    audioProps,
  };
}
