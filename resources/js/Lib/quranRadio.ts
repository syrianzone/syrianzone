// Live Quran recitation radio — shared data layer.
//
// The stream list is MP3Quran's v4 API (`/v4/radios`), which categorises every
// station and exposes a ready `stream_url`. Every stream is a Shoutcast
// endpoint: `audio/mpeg`, 128 kbps, `access-control-allow-origin: *`,
// `accept-ranges: none` and `cache-control: no-cache`. Two consequences the
// players are built around: there is no duration and no seeking (so no
// progress bar), and the service worker must never cache non-audio hosts — it
// only intercepts everyayah.com audio and lets everything else through.

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRadios, type V4Radio } from '@/Pages/Muslim/_lib/mp3quran';

export interface QuranRadioStation {
  id: number;
  name: string;
  url: string;
}

/**
 * v4 categorises every station, so the filter is an allowlist of recitation
 * categories instead of the v3 id blocklist. `القراء` is a single reciter
 * reading the Quran and `القراءات العشر` is the ten qiraahs. The translation,
 * adhkar, tafsir, hadith, seerah, fatwa, ruqyah and mixed-reader compilation
 * categories are all excluded.
 */
export const RECITATION_RADIO_CATEGORIES: ReadonlySet<string> = new Set([
  'القراء',
  'القراءات العشر',
]);

/** One v4 radio row → the app's station shape; null when it is not a recitation. */
export function mapRecitationRadio(radio: V4Radio): QuranRadioStation | null {
  if (!RECITATION_RADIO_CATEGORIES.has(radio.category)) return null;
  if (!radio.stream_url) return null;
  return {
    id: radio.id,
    name: radio.name.replace(/[-\s]+$/, '').trim(),
    url: radio.stream_url,
  };
}

export function mapRecitationRadios(radios: V4Radio[]): QuranRadioStation[] {
  const out: QuranRadioStation[] = [];
  for (const r of radios) {
    const station = mapRecitationRadio(r);
    if (station) out.push(station);
  }
  return out;
}

/** Reciters pinned to the top of the list, in the order we want them heard. */
export const POPULAR_QURAN_RADIO_IDS: readonly number[] = [74, 30, 70, 79, 63, 85, 32, 3];

/**
 * What the player falls back to when the list cannot be fetched, so the
 * applet is never empty offline. Ids/urls verified against v4.
 */
export const CURATED_QURAN_RADIOS: readonly QuranRadioStation[] = [
  { id: 74, name: 'محمود خليل الحصري', url: 'https://backup.qurango.net/radio/mahmoud_khalil_alhussary' },
  { id: 30, name: 'عبدالباسط عبدالصمد (مجوّد)', url: 'https://backup.qurango.net/radio/abdulbasit_abdulsamad_mojawwad' },
  { id: 70, name: 'محمد صديق المنشاوي (مجوّد)', url: 'https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad' },
  { id: 79, name: 'مشاري العفاسي', url: 'https://backup.qurango.net/radio/mishary_alafasi' },
  { id: 63, name: 'ماهر المعيقلي', url: 'https://backup.qurango.net/radio/maher' },
  { id: 85, name: 'محمود الشيمي', url: 'https://backup.qurango.net/radio/mahmood_alsheimy' },
  { id: 32, name: 'عبدالباسط عبدالصمد (مرتل)', url: 'https://backup.qurango.net/radio/abdulbasit_abdulsamad' },
  { id: 3, name: 'أحمد العجمي', url: 'https://backup.qurango.net/radio/ahmad_alajmy' },
];

/** Pinned reciters first, then everyone else alphabetically by Arabic name. */
export function orderStations(stations: QuranRadioStation[]): QuranRadioStation[] {
  const rank = new Map(POPULAR_QURAN_RADIO_IDS.map((id, i) => [id, i]));
  return [...stations].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra !== undefined && rb !== undefined) return ra - rb;
    if (ra !== undefined) return -1;
    if (rb !== undefined) return 1;
    return a.name.localeCompare(b.name, 'ar');
  });
}

/**
 * Fetches the reciter channels. Never throws: a failure returns the curated
 * list so a caller can render something playable instead of an empty applet.
 */
export async function fetchQuranRadioStations(signal?: AbortSignal): Promise<QuranRadioStation[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const radios = await fetchRadios(ctrl.signal);
    const reciters = mapRecitationRadios(radios);
    if (reciters.length === 0) throw new Error('empty list');
    return orderStations(reciters);
  } catch {
    return [...CURATED_QURAN_RADIOS];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export interface QuranRadioStationsState {
  stations: QuranRadioStation[];
  /** True until the first fetch settles; the curated list is already usable. */
  isLoading: boolean;
  /** Set when the live list failed and the curated fallback is in use. */
  isFallback: boolean;
  reload: () => void;
}

/** Loads the station list once, falling back to the curated reciters. */
export function useQuranRadioStations(): QuranRadioStationsState {
  const [stations, setStations] = useState<QuranRadioStation[]>(() => [...CURATED_QURAN_RADIOS]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const ctrl = new AbortController();
    setIsLoading(true);
    fetchQuranRadioStations(ctrl.signal).then((list) => {
      if (!alive.current) return;
      setStations(list);
      setIsFallback(list.length === CURATED_QURAN_RADIOS.length);
      setIsLoading(false);
    });
    return () => {
      alive.current = false;
      ctrl.abort();
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { stations, isLoading, isFallback, reload };
}

// --- Single-stream guard -----------------------------------------------------
//
// Two players can be mounted at once (the Board widget is registered with
// `multiple: true`, and the Muslim corner has its own applet). Without this
// they play over each other. The stream that started most recently wins.

const liveStreams = new Set<HTMLAudioElement>();

export function claimLiveStream(el: HTMLAudioElement | null): void {
  if (!el) return;
  liveStreams.forEach((other) => {
    if (other !== el) other.pause();
  });
  liveStreams.add(el);
}

export function releaseLiveStream(el: HTMLAudioElement | null): void {
  if (el) liveStreams.delete(el);
}
