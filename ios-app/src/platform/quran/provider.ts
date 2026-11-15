import { api } from '../../api';
import { array, finiteNumber, integer, record, text } from '../validation';
import { ayahAudioUrl, recitations, type AyahTiming, type LetterTiming, type TextWord, type WordTiming } from './source-rules';

const BASE = 'https://api-staging.mp3quran.net';
export interface SurahAudio {
  url: string; ayahs: AyahTiming[]; words: WordTiming[]; text: Map<number, TextWord[]>; fallback: boolean;
}
export interface QuranProvider {
  surah(code: string, surah: number, ayah: number, signal: AbortSignal): Promise<SurahAudio>;
  letters(code: string, surah: number, ayah: number, signal: AbortSignal): Promise<LetterTiming[]>;
  enrich?(code: string, surah: number, signal: AbortSignal): Promise<{ words: WordTiming[]; text: Map<number, TextWord[]> }>;
}
export function audioUrl(value: unknown): string {
  const url = new URL(text(value));
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port
    || !((url.hostname === 'cdn.mp3quran.net' && /^\/audio\/[a-z0-9-]+\/r\d+\/\d{3}(?:-64k)?\.mp3$/.test(url.pathname))
      || (url.hostname === 'everyayah.com' && /^\/data\/[A-Za-z0-9_]+\/\d{6}\.mp3$/.test(url.pathname)))) throw new Error('مصدر التلاوة غير صالح.');
  return url.toString();
}
function path(code: string, surah: number): string {
  if (!/^[a-z0-9-]+\/r\d+$/.test(code) || !Number.isInteger(surah) || surah < 1 || surah > 114) throw new Error('التلاوة غير صالحة.');
  return `${BASE}/v4/recitations/${code}/surahs/${surah}`;
}
function tuples(value: unknown, length: number): number[][] {
  return array(value).slice(0, 100_000).map(raw => {
    const row = array(raw);
    if (row.length !== length) throw new Error('توقيت التلاوة غير صالح.');
    return row.map(finiteNumber);
  });
}
export function decodeAyahs(value: unknown): AyahTiming[] {
  return tuples(record(record(value).data).ayahs, 3).map(row => {
    const [ayah, start, end] = row;
    if (ayah === undefined || start === undefined || end === undefined || !Number.isInteger(ayah) || start < 0 || end < start) throw new Error('توقيت الآية غير صالح.');
    return [ayah, start, end] as AyahTiming;
  }).filter(row => row[0] > 0).sort((a, b) => a[1] - b[1]);
}
export function decodeWords(value: unknown): { words: WordTiming[]; text: Map<number, TextWord[]> } {
  const data = record(record(value).data);
  const words = tuples(data.words ?? [], 5).map(row => {
    const [ayah, position, start, end, occurrence] = row;
    if (ayah === undefined || position === undefined || start === undefined || end === undefined || occurrence === undefined
      || !Number.isInteger(ayah) || position < 1 || !Number.isInteger(position) || occurrence < 1 || !Number.isInteger(occurrence) || start < 0 || end < start) throw new Error('توقيت الكلمة غير صالح.');
    return [ayah, position, start, end, occurrence] as WordTiming;
  }).filter(row => row[0] > 0).sort((a, b) => a[2] - b[2]);
  return { words, text: data.text ? decodeText({ data: data.text }) : new Map() };
}
export function decodeText(value: unknown): Map<number, TextWord[]> {
  return new Map(array(record(record(value).data).ayahs).map(raw => {
    const row = array(raw), ayah = integer(row[0]);
    const words = array(row[1]).map(rawWord => {
      const word = array(rawWord);
      return [integer(word[0]), text(word[1]), word[2] == null ? null : text(word[2])] as TextWord;
    });
    return [ayah, words];
  }));
}
export function decodeLetters(value: unknown): LetterTiming[] {
  return array(record(record(value).data).letters ?? []).slice(0, 100_000).map(raw => {
    const row = array(raw);
    if (row.length !== 7) throw new Error('توقيت الحرف غير صالح.');
    const ayah = integer(row[0]), position = integer(row[1]), letter = integer(row[2]), start = finiteNumber(row[3]), end = finiteNumber(row[4]), occurrence = integer(row[5]);
    if (ayah < 1 || position < 1 || letter < 1 || start < 0 || end < start || occurrence < 1) throw new Error('توقيت الحرف غير صالح.');
    return [ayah, position, letter, start, end, occurrence, row[6] == null ? null : finiteNumber(row[6])] as LetterTiming;
  }).sort((a, b) => a[3] - b[3]);
}
export const quranProvider: QuranProvider = {
  async surah(code, surah, ayah, signal) {
    const recitation = recitations.find(item => item.code === code);
    const base = path(code, surah);
    try {
      const [metadata, ayahs] = await Promise.all([api.externalJson(base, value => record(record(value).data), { signal }), api.externalJson(`${base}/ayah-timings`, decodeAyahs, { signal })]);
      const files = record(metadata.files), url = audioUrl(record(files.mp3_64 ?? {}).url ?? record(files.original).url);
      if (!ayahs.length) throw new Error('no timings');
      return { url, ayahs, words: [], text: new Map(), fallback: false };
    } catch (cause) {
      if (signal.aborted || !recitation) throw cause;
      const url = audioUrl(ayahAudioUrl(recitation, surah, ayah));
      return { url, ayahs: [], words: [], text: new Map(), fallback: true };
    }
  },
  async enrich(code, surah, signal) {
    let words: WordTiming[] = [], written = new Map<number, TextWord[]>();
    try { const result = await api.externalJson(`${path(code, surah)}/word-timings?include=text`, decodeWords, { signal }); words = result.words; written = result.text; }
    catch { if (signal.aborted) throw new Error('cancelled'); }
    if (!written.size) {
      const recitation = recitations.find(item => item.code === code);
      written = await api.externalJson(`${BASE}/v4/surahs/${surah}/text?riwayah=${encodeURIComponent(recitation?.riwayah ?? 'hafs_an_asim')}`, decodeText, { signal });
    }
    return { words, text: written };
  },
  letters: (code, surah, ayah, signal) => api.externalJson(`${path(code, surah)}/letter-timings?ayah=${ayah}`, decodeLetters, { signal })
};

// PORT STATUS: source resources/js/Domain/quran/mp3quran.ts; confidence high; todos 0.
