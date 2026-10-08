import type { AyahTiming, LetterTiming, V4SurahItem, WordTiming } from './mp3quran';

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

// --- Word-level karaoke ------------------------------------------------------

/** Marker token shape, duplicated from AyahMarker to keep this module pure. */
const MARKER_RE = /﴿([٠-٩]{1,3})﴾/g;

export type PartToken =
  | { kind: 'marker'; digits: string }
  | { kind: 'word'; value: string }
  | { kind: 'symbol'; value: string }
  | { kind: 'space'; value: string };

/**
 * Split a part's display text into markers, whole words, standalone symbols
 * (waqf marks, rub-el-hizb, sajdah — no Arabic letter) and whitespace runs.
 * Concatenating the values reproduces the input exactly. Splitting happens only
 * at whitespace, so Arabic letter joining is never broken (skill §10).
 */
export function splitPartTokens(text: string): PartToken[] {
  const out: PartToken[] = [];
  const pushText = (s: string) => {
    let i = 0;
    while (i < s.length) {
      const isSpace = /\s/.test(s[i]);
      let j = i;
      while (j < s.length && /\s/.test(s[j]) === isSpace) j += 1;
      const value = s.slice(i, j);
      if (isSpace) out.push({ kind: 'space', value });
      else if (normalizeArabicWord(value) === '') out.push({ kind: 'symbol', value });
      else out.push({ kind: 'word', value });
      i = j;
    }
  };
  let last = 0;
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(text)) !== null) {
    if (m.index > last) pushText(text.slice(last, m.index));
    out.push({ kind: 'marker', digits: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) pushText(text.slice(last));
  return out;
}

/** Word tokens of an ayah's joined text (markers and whitespace dropped). */
export function wordsOfText(text: string): string[] {
  const out: string[] = [];
  for (const tok of splitPartTokens(text)) {
    if (tok.kind === 'word') out.push(tok.value);
  }
  return out;
}

/**
 * Aggressive normalisation for aligning the local Madina rasm with the API's
 * hafs edition: drop Quranic marks/tatweels and zero-width chars, unify alef,
 * ya and ta marbuta, resolve hamza carriers and small waw/yeh to their base
 * letters, collapse doubled letters, and keep Arabic letters only. Applied to
 * both sides, so the comparison is consistent.
 */
export function normalizeArabicWord(word: string): string {
  return word
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06E4\u06E7-\u06ED\u0640\u08F0-\u08FF]/g, '')
    // Small waw / small yeh stand for a letter in the API edition.
    .replace(/\u06E5/g, 'و')
    .replace(/\u06E6/g, 'ي')
    .replace(/[\u200B-\u200F\u2066-\u2069\uFEFF]/g, '')
    .replace(/[أإآٱٲٳ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    // Hamza carriers keep their base letter; a bare hamza is not a letter here.
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ء/g, '')
    .replace(/[^\u0621-\u064A]/g, '')
    // An elided letter can be written twice (small waw + full waw): collapse.
    .replace(/(.)\1+/g, '$1');
}

/**
 * Map each API word position (index j → local word index) to the local Madina
 * word. Exact matches are consumed first; adjacent local words may merge into
 * one API word (or the reverse), which covers rasm splitting such as 15:7
 * ("لو ما" vs "لوما"). Returns null when the sequences cannot be reconciled,
 * in which case the caller falls back to ayah-level highlighting.
 */
export function alignWordIndexes(local: string[], api: string[]): number[] | null {
  if (local.length === 0 || api.length === 0) return null;
  const L = local.map(normalizeArabicWord);
  const A = api.map(normalizeArabicWord);
  const map = new Array<number>(A.length).fill(-1);
  let i = 0;
  let j = 0;
  while (i < L.length && j < A.length) {
    if (L[i] !== '' && L[i] === A[j]) {
      map[j] = i;
      i += 1;
      j += 1;
      continue;
    }
    if (i + 1 < L.length && L[i] + L[i + 1] === A[j]) {
      map[j] = i;
      i += 2;
      j += 1;
      continue;
    }
    if (j + 1 < A.length && L[i] === A[j] + A[j + 1]) {
      map[j] = i;
      map[j + 1] = i;
      i += 1;
      j += 2;
      continue;
    }
    return null;
  }
  if (i !== L.length || j !== A.length) return null;
  return map;
}

/** The word sounding at `positionMs`, or null in a gap / outside the file. */
export function findWordAt(words: WordTiming[], positionMs: number): WordTiming | null {
  let lo = 0;
  let hi = words.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid][2] <= positionMs) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (candidate < 0) return null;
  const word = words[candidate];
  return positionMs < word[3] ? word : null;
}

/** The letter sounding at `positionMs`, or null in a gap / outside the file. */
export function findLetterAt(letters: LetterTiming[], positionMs: number): LetterTiming | null {
  let lo = 0;
  let hi = letters.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (letters[mid][3] <= positionMs) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (candidate < 0) return null;
  const letter = letters[candidate];
  return positionMs < letter[4] ? letter : null;
}

/** Key for a single word heard at one occurrence. */
export function wordOccurrenceKey(ayah: number, position: number, occurrence: number): string {
  return `${ayah}:${position}:${occurrence}`;
}
