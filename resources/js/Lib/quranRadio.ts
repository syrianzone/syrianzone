// Live Quran recitation radio — shared data layer.
//
// The stream list is MP3Quran's public v3 API. Every stream is a Shoutcast
// endpoint: `audio/mpeg`, 128 kbps, `access-control-allow-origin: *`,
// `accept-ranges: none` and `cache-control: no-cache`. Two consequences the
// players are built around: there is no duration and no seeking (so no
// progress bar), and the service worker must never cache these hosts — it
// currently only intercepts everyayah.com and lets everything else through.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface QuranRadioStation {
  id: number;
  name: string;
  url: string;
}

/**
 * The `www.` host is deliberate: `mp3quran.net` answers 301 and the browser
 * pays a second round trip for every consumer of this list.
 */
export const QURAN_RADIO_API = 'https://www.mp3quran.net/api/v3/radios?language=ar';

/**
 * Channels that are not one reciter reading the Quran. The endpoint returns
 * 177 stations and mixes recitation with adhkar, tafsir, hadith, seerah,
 * fatwas, ruqyah and ~22 translation feeds — none of which belong in a
 * recitation radio. Verified against the live list; new non-Quran channels
 * will show up until they are added here.
 */
const NON_RECITER_IDS: ReadonlySet<number> = new Set([
  // Mixed-reader compilations and single-surah channels.
  108, 109, 115, 123, 10902, 109060, 109083,
  // Other Islamic programming: adhkar, tafsir, hadith, seerah, fatwa, ruqyah, fiqh.
  110, 113, 114, 116, 10903, 10904, 10906, 10907, 21114, 21115, 21117,
  109061, 109066, 109067, 109069, 109073, 109076,
  // Meanings of the Quran in other languages.
  109039, 109040, 109041, 109042, 109043, 109044, 109045, 109046, 109047,
  109048, 109049, 109050, 109051, 109052, 109053, 109054, 109055, 109056,
  109057, 109058, 109059, 109062,
  // A station rather than a reciter, and dead (404) since at least 2026-09.
  109082,
]);

/** Reciters pinned to the top of the list, in the order we want them heard. */
export const POPULAR_QURAN_RADIO_IDS: readonly number[] = [74, 30, 70, 79, 63, 85, 32, 3];

/**
 * What the player falls back to when the list cannot be fetched, so the
 * applet is never empty offline. Every entry answered 200 when checked.
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

export function isReciterStation(station: { id: number }): boolean {
  return !NON_RECITER_IDS.has(station.id);
}

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
    const res = await fetch(QURAN_RADIO_API, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const radios = Array.isArray(data?.radios) ? data.radios : [];
    const reciters = radios.filter(isReciterStation);
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
