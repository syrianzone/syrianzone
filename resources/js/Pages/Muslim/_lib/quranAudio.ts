import type { AyahTiming, V4SurahItem } from './mp3quran';

export interface AyahSpan {
  start: number;
  end: number;
}

let probe: HTMLAudioElement | null = null;

function canPlay(mime: string): boolean {
  if (typeof document === 'undefined') return false;
  if (!probe) probe = document.createElement('audio');
  return probe.canPlayType(mime) !== '';
}

/**
 * Choose the smallest playable tier: Opus where supported, else 64 kbit/s MP3,
 * else the source file. Returns null when the item carries no usable URL.
 */
export function pickAudioTier(files: V4SurahItem['files']): string | null {
  if (files.opus_48?.url && canPlay('audio/ogg; codecs=opus')) return files.opus_48.url;
  if (files.mp3_64?.url) return files.mp3_64.url;
  if (files.original?.url) return files.original.url;
  return files.opus_48?.url ?? null;
}

/** Ayah number → span. Basmalah (0) and istiadhah (-1) are dropped. */
export function ayahTimingMap(timings: AyahTiming[]): Map<number, AyahSpan> {
  const map = new Map<number, AyahSpan>();
  for (const [ayah, start, end] of timings) {
    if (ayah > 0) map.set(ayah, { start, end });
  }
  return map;
}

/**
 * Binary search the ayah sounding at `positionMs`, given time-ordered ayah
 * timings. Returns null in a gap or outside the file.
 */
export function findAyahAt(timings: AyahTiming[], positionMs: number): AyahTiming | null {
  let lo = 0;
  let hi = timings.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const [, start, end] = timings[mid];
    if (positionMs < start) hi = mid - 1;
    else if (positionMs >= end) lo = mid + 1;
    else return timings[mid];
  }
  return null;
}
