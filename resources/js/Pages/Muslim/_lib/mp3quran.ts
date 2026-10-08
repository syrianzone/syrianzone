// MP3Quran v4 API client (read-only, cursor-paginated).
//
// Docs: https://docs-staging.mp3quran.net/ — the v4 catalogue is addressed by
// permanent `code`s (store the code, never the numeric id; a numeric id 301s
// to its code). Responses are `{ data, meta }` for one resource and
// `{ data, meta, links }` for a list; errors are `{ error: { code, message,
// field? } }` with the real HTTP status. The API answers `access-control-
// allow-origin: *`, so the browser talks to it directly (no PHP proxy).
//
// Base URL is env-configurable so staging can be swapped for production when
// v4 ships without touching call sites.

export const MP3QURAN_API_BASE: string =
  import.meta.env.VITE_MP3QURAN_API ?? 'https://api-staging.mp3quran.net';

export interface V4ErrorBody {
  error: { code: string; message: string; field?: string };
}

export class Mp3QuranError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string;

  constructor(status: number, body: V4ErrorBody['error']) {
    super(body.message);
    this.name = 'Mp3QuranError';
    this.status = status;
    this.code = body.code;
    this.field = body.field;
  }
}

export type QueryValue = string | number | boolean | undefined | null;
export type Query = Record<string, QueryValue>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, MP3QURAN_API_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

// Deduplicate concurrent identical requests; the HTTP cache handles the rest.
const inflight = new Map<string, Promise<unknown>>();

async function v4Get<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
  const url = buildUrl(path, query);
  const cached = !signal ? inflight.get(url) : undefined;
  if (cached) return cached as Promise<T>;

  const request = (async () => {
    const res = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    const body = (await res.json().catch(() => null)) as T | V4ErrorBody | null;
    if (!res.ok) {
      const err = (body as V4ErrorBody | null)?.error;
      throw new Mp3QuranError(
        res.status,
        err ?? { code: 'internal', message: `HTTP ${res.status}` },
      );
    }
    return (body as T);
  })();

  if (!signal) {
    inflight.set(url, request);
    request.catch(() => undefined).finally(() => inflight.delete(url));
  }
  return request;
}

// --- Catalogue ---------------------------------------------------------------

export interface V4Reciter {
  id: number;
  code: string;
  name: string;
  name_latin?: string;
  recitation_count?: number;
}

export interface V4Riwayah {
  code: string;
  qiraah?: string;
  name?: string;
}

export interface V4Recitation {
  id: number;
  code: string;
  reciter?: { id: number; name: string; code: string };
  riwayahs?: V4Riwayah[];
  style?: string;
  has_ayah_timings?: boolean;
  coverage?: { complete: boolean; surahs?: number[] };
  audio?: { base: string; files: Record<string, string> };
}

export type RecitationStyle = 'murattal' | 'mujawwad' | 'muallim' | 'featured' | 'archival';

export interface ReciterQuery extends Query {
  q?: string;
  has?: string;
  riwayah?: string;
  country?: string;
  sort?: string;
  limit?: number;
  all?: boolean;
}

export interface RecitationQuery extends Query {
  reciter?: string;
  riwayah?: string;
  qiraah?: string;
  tariq?: string;
  style?: RecitationStyle | string;
  surah?: number;
  has?: string;
  updated_since?: string;
  sort?: string;
  limit?: number;
  all?: boolean;
}

export function searchReciters(q: string, signal?: AbortSignal): Promise<V4Reciter[]> {
  return v4Get<{ data: V4Reciter[] }>('/v4/reciters', { q }, signal).then((r) => r.data);
}

export function fetchReciters(query: ReciterQuery = {}, signal?: AbortSignal): Promise<V4Reciter[]> {
  return v4Get<{ data: V4Reciter[] }>('/v4/reciters', query, signal).then((r) => r.data);
}

export function fetchRecitations(query: RecitationQuery = {}, signal?: AbortSignal): Promise<V4Recitation[]> {
  return v4Get<{ data: V4Recitation[] }>('/v4/recitations', query, signal).then((r) => r.data);
}

// A recitation code is a two-segment path (`reciter/rN`), so encode each
// segment but keep its slash literal to match the documented route shape.
function recitationPath(code: string): string {
  return code.split('/').map(encodeURIComponent).join('/');
}

export function getRecitation(code: string, signal?: AbortSignal): Promise<V4Recitation> {
  return v4Get<{ data: V4Recitation }>(`/v4/recitations/${recitationPath(code)}`, undefined, signal).then(
    (r) => r.data,
  );
}

export interface V4SurahSummary {
  number: number;
  code: string;
  ayah_count: number;
  revelation?: string;
}

/** The 114 surahs with their ayah counts (for a continuous queue). */
export function fetchSurahs(signal?: AbortSignal): Promise<V4SurahSummary[]> {
  return v4Get<{ data: V4SurahSummary[] }>('/v4/surahs', { all: true }, signal).then((r) => r.data);
}

// --- Audio files -------------------------------------------------------------

export type AudioTier = 'original' | 'mp3_64' | 'opus_48';

export interface V4SurahFile {
  url: string;
  bytes?: number;
  sha256?: string;
  bitrate_kbps?: number;
}

export interface V4SurahItem {
  surah: number;
  duration_ms?: number | null;
  /** Levels measured for this file, e.g. ["ayah","word","letter","phoneme"]. */
  timings?: string[];
  files: Partial<Record<AudioTier, V4SurahFile>>;
}

export function getSurah(
  recitationCode: string,
  surah: number,
  signal?: AbortSignal,
): Promise<V4SurahItem> {
  return v4Get<{ data: V4SurahItem }>(
    `/v4/recitations/${recitationPath(recitationCode)}/surahs/${surah}`,
    undefined,
    signal,
  ).then((r) => r.data);
}

// --- Timings -----------------------------------------------------------------
//
// Entries are time-ordered tuples:
//   ayah    [ayah, start_ms, end_ms]
//   word    [ayah, word_position, start_ms, end_ms, occurrence]
//   letter  [ayah, word_position, letter_index, start_ms, end_ms, occurrence, conf]
//   phoneme [ayah, word_position, letter_index, phoneme_index, start_ms, end_ms, occurrence, conf]

export type AyahTiming = [ayah: number, start_ms: number, end_ms: number];
export type WordTiming = [
  ayah: number,
  word_position: number,
  start_ms: number,
  end_ms: number,
  occurrence: number,
];
export type LetterTiming = [
  ayah: number,
  word_position: number,
  letter_index: number,
  start_ms: number,
  end_ms: number,
  occurrence: number,
  conf: number | null,
];
export type PhonemeTiming = [
  ayah: number,
  word_position: number,
  letter_index: number,
  phoneme_index: number,
  start_ms: number,
  end_ms: number,
  occurrence: number,
  conf: number | null,
];

export type TimingLevel = 'ayah' | 'word' | 'letter' | 'phoneme';

export interface TimingQuery extends Query {
  ayah?: string | number;
  from_ms?: number;
  to_ms?: number;
  at_ms?: number;
  view?: 'playback' | 'positions';
  include?: string;
}

/** `[word_position, rasm_uthmani, rasm_imlai | null]`. */
export type TextWord = [word_position: number, rasm_uthmani: string, rasm_imlai: string | null];
/** `[ayah, TextWord[]]`. */
export type TextAyah = [ayah: number, words: TextWord[]];

interface RawTimings {
  surah: number;
  [key: string]: unknown;
}

function getTimings<T = RawTimings>(
  recitationCode: string,
  surah: number,
  level: TimingLevel,
  query: TimingQuery = {},
  signal?: AbortSignal,
): Promise<T> {
  return v4Get<{ data: T }>(
    `/v4/recitations/${recitationPath(recitationCode)}/surahs/${surah}/${level}-timings`,
    query,
    signal,
  ).then((r) => r.data);
}

export function getAyahTimings(
  recitationCode: string,
  surah: number,
  query: TimingQuery = {},
  signal?: AbortSignal,
): Promise<{ surah: number; complete?: boolean; ayahs: AyahTiming[] }> {
  return getTimings(recitationCode, surah, 'ayah', query, signal);
}

export interface WordTimingsData {
  surah: number;
  words?: WordTiming[];
  estimated?: number[];
  text?: { edition: string; ayahs: TextAyah[] } | null;
}

export function getWordTimings(
  recitationCode: string,
  surah: number,
  query: TimingQuery = {},
  signal?: AbortSignal,
): Promise<WordTimingsData> {
  return getTimings<WordTimingsData>(recitationCode, surah, 'word', query, signal);
}

export interface LetterTimingsData {
  surah: number;
  letters?: LetterTiming[];
}

export function getLetterTimings(
  recitationCode: string,
  surah: number,
  query: TimingQuery = {},
  signal?: AbortSignal,
): Promise<LetterTimingsData> {
  return getTimings<LetterTimingsData>(recitationCode, surah, 'letter', query, signal);
}

export function getPhonemeTimings(
  recitationCode: string,
  surah: number,
  query: TimingQuery = {},
  signal?: AbortSignal,
): Promise<{ surah: number; phonemes?: PhonemeTiming[] }> {
  return getTimings(recitationCode, surah, 'phoneme', query, signal);
}

/** Written text of a surah, riwayah-aware (`/v4/surahs/{n}/text`). */
export function getSurahText(
  surah: number,
  query: Query = {},
  signal?: AbortSignal,
): Promise<{ surah: number; edition: string; ayahs: TextAyah[] }> {
  return v4Get<{ data: { surah: number; edition: string; ayahs: TextAyah[] } }>(
    `/v4/surahs/${surah}/text`,
    query,
    signal,
  ).then((r) => r.data);
}

// --- Radio -------------------------------------------------------------------

export interface V4Radio {
  id: number;
  name: string;
  stream_url: string;
  category: string;
  is_playlist?: boolean;
  reciter?: { id: number; name: string; code: string } | null;
  recitation?: { id: number; code: string | null } | null;
  riwayah?: { code: string; qiraah?: string; name?: string } | null;
}

export function fetchRadios(signal?: AbortSignal): Promise<V4Radio[]> {
  return v4Get<{ data: V4Radio[] }>('/v4/radios', { limit: 200 }, signal).then((r) => r.data);
}
