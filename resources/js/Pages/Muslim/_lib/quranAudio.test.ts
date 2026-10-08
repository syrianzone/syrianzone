import { describe, expect, it } from 'vitest';
import {
  ayahTimingMap,
  findAyahAt,
  findWordAt,
  normalizeArabicWord,
  pickAudioTier,
  sameWordSequence,
  splitPartTokens,
  wordsOfText,
} from './quranAudio';
import type { AyahTiming, WordTiming } from './mp3quran';

describe('pickAudioTier', () => {
  it('prefers mp3_64 over the source when Opus is unsupported (node)', () => {
    expect(
      pickAudioTier({
        original: { url: 'o.mp3' },
        mp3_64: { url: 'm64.mp3' },
        opus_48: { url: 'a.opus' },
      }),
    ).toBe('m64.mp3');
  });

  it('uses the source when it is the only tier', () => {
    expect(pickAudioTier({ original: { url: 'o.mp3' } })).toBe('o.mp3');
  });

  it('falls back to an Opus-only item rather than returning null', () => {
    expect(pickAudioTier({ opus_48: { url: 'a.opus' } })).toBe('a.opus');
  });

  it('returns null for an empty file map', () => {
    expect(pickAudioTier({})).toBeNull();
  });
});

describe('ayahTimingMap', () => {
  it('drops the basmalah and istiadhah rows', () => {
    const map = ayahTimingMap([
      [-1, 0, 73],
      [0, 73, 7400],
      [1, 8681, 74180],
    ]);
    expect([...map.keys()]).toEqual([1]);
    expect(map.get(1)).toEqual({ start: 8681, end: 74180 });
  });
});

describe('findAyahAt', () => {
  const timings: AyahTiming[] = [
    [0, 73, 7400],
    [1, 8681, 12105],
    [2, 12105, 13945],
    [1, 33033, 34425],
  ];

  it('finds the entry covering the position', () => {
    expect(findAyahAt(timings, 9000)?.[0]).toBe(1);
    expect(findAyahAt(timings, 13000)?.[0]).toBe(2);
  });

  it('finds a repeated word position (occurrence) by its own span', () => {
    expect(findAyahAt(timings, 33500)).toEqual([1, 33033, 34425]);
  });

  it('returns null in a gap between entries', () => {
    expect(findAyahAt(timings, 20000)).toBeNull();
  });

  it('returns null before the first span', () => {
    expect(findAyahAt(timings, 10)).toBeNull();
  });
});

describe('splitPartTokens', () => {
  it('reproduces the input exactly when concatenated', () => {
    const text = 'قُلْ هُوَ ٱللَّهُ ﴿١﴾';
    const tokens = splitPartTokens(text);
    const rebuilt = tokens
      .map((t) => (t.kind === 'marker' ? `﴿${t.digits}﴾` : t.value))
      .join('');
    expect(rebuilt).toBe(text);
  });

  it('classifies words, spaces and markers', () => {
    const tokens = splitPartTokens('بسم ﴿١﴾ الله');
    expect(tokens.map((t) => t.kind)).toEqual(['word', 'space', 'marker', 'space', 'word']);
  });
});

describe('wordsOfText', () => {
  it('drops markers and whitespace, keeping words in order', () => {
    expect(wordsOfText('بسم ﴿١﴾ الرحمن الرحيم')).toEqual(['بسم', 'الرحمن', 'الرحيم']);
  });
});

describe('normalizeArabicWord', () => {
  it('strips marks, tatweel and zero-width chars', () => {
    expect(normalizeArabicWord('ٱلرَّحۡمَٰنِ')).toBe(normalizeArabicWord('الرحمن'));
  });

  it('unifies alef, ya and ta marbuta forms', () => {
    expect(normalizeArabicWord('إِسۡرَآءِيلَ')).toBe(normalizeArabicWord('اسرائيل'));
  });
});

describe('sameWordSequence', () => {
  it('accepts sequences that differ only in diacritics', () => {
    expect(sameWordSequence(['ٱلنَّاسُ', 'ٱتَّقُواْ'], ['الناس', 'اتقوا'])).toBe(true);
  });

  it('rejects a length mismatch', () => {
    expect(sameWordSequence(['ا', 'ب'], ['ا'])).toBe(false);
  });

  it('rejects a content mismatch', () => {
    expect(sameWordSequence(['ا', 'ب'], ['ا', 'ج'])).toBe(false);
  });

  it('rejects empty sequences', () => {
    expect(sameWordSequence([], [])).toBe(false);
  });
});

describe('findWordAt', () => {
  const words: WordTiming[] = [
    [1, 1, 8681, 12105, 1],
    [1, 2, 12105, 13945, 1],
    [1, 10, 26225, 27345, 1],
    [1, 10, 33033, 34425, 2],
  ];

  it('finds the word sounding at a position', () => {
    expect(findWordAt(words, 9000)).toEqual([1, 1, 8681, 12105, 1]);
    expect(findWordAt(words, 13000)?.[1]).toBe(2);
  });

  it('distinguishes repeated words by occurrence', () => {
    expect(findWordAt(words, 33500)?.[4]).toBe(2);
  });

  it('returns null in a gap', () => {
    expect(findWordAt(words, 30000)).toBeNull();
  });

  it('returns null before the first word', () => {
    expect(findWordAt(words, 10)).toBeNull();
  });
});
