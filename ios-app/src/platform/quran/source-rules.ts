export interface Recitation { code: string; nameAr: string; nameEn: string; reciterCode: string; style: string; riwayah: string; folder: string | null }
export type AyahTiming = [number, number, number];
export type WordTiming = [number, number, number, number, number];
export type LetterTiming = [number, number, number, number, number, number, number | null];
export type TextWord = [number, string, string | null];
export type PartToken = { kind: 'word' | 'space' | 'symbol'; value: string } | { kind: 'marker'; digits: string };

// These unchanged source rules need no browser APIs. Typed require keeps the
// website's looser TypeScript settings out of the native strict compilation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const quran = require('../../../../resources/js/Domain/quran/quran') as {
  QURAN_RECITATIONS: Recitation[]; SURAH_NAMES_AR: string[]; SURAH_AYAH_COUNTS: number[]; DEFAULT_RECITATION_CODE: string;
  normalizeRecitationCode(value: string | null | undefined): string;
  recitationByCode(code: string): Recitation;
  ayahAudioUrl(recitation: Recitation, surah: number, ayah: number): string;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const timings = require('../../../../resources/js/Domain/quran/quranAudio') as {
  findAyahAt(rows: AyahTiming[], milliseconds: number): AyahTiming | null;
  findWordAt(rows: WordTiming[], milliseconds: number): WordTiming | null;
  findLetterAt(rows: LetterTiming[], milliseconds: number): LetterTiming | null;
  splitPartTokens(text: string): PartToken[];
  wordsOfText(text: string): string[];
  alignWordIndexes(local: string[], provider: string[]): number[] | null;
  wordOccurrenceKey(ayah: number, position: number, occurrence: number): string;
};
export const recitations = quran.QURAN_RECITATIONS;
export const surahNames = quran.SURAH_NAMES_AR;
export const ayahCounts = quran.SURAH_AYAH_COUNTS;
export const defaultRecitationCode = quran.DEFAULT_RECITATION_CODE;
export const normalizeRecitationCode = quran.normalizeRecitationCode;
export const recitationByCode = quran.recitationByCode;
export const ayahAudioUrl = quran.ayahAudioUrl;
export const { findAyahAt, findWordAt, findLetterAt, splitPartTokens, wordsOfText, alignWordIndexes, wordOccurrenceKey } = timings;

// PORT STATUS: source resources/js/Domain/quran/quranAudio.ts; confidence high; todos 0.
