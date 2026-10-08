import { describe, expect, it } from 'vitest';
import {
  alignWordIndexes,
  ayahTimingMap,
  findAyahAt,
  findLetterAt,
  findWordAt,
  normalizeArabicWord,
  pickAudioTier,
  splitPartTokens,
  wordOccurrenceKey,
  wordsOfText,
} from './quranAudio';
import type { AyahTiming, LetterTiming, WordTiming } from './mp3quran';

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

  it('classifies a standalone symbol as a symbol, not a word', () => {
    expect(splitPartTokens('۞ بسم').map((t) => t.kind)).toEqual(['symbol', 'space', 'word']);
  });

  it('keeps a symbol attached to a word as part of the word', () => {
    const tokens = splitPartTokens('شَيْءٍۚ');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe('word');
  });
});

describe('wordsOfText', () => {
  it('drops markers and whitespace, keeping words in order', () => {
    expect(wordsOfText('بسم ﴿١﴾ الرحمن الرحيم')).toEqual(['بسم', 'الرحمن', 'الرحيم']);
  });

  it('ignores standalone symbols when counting words', () => {
    expect(wordsOfText('۞ بسم الله')).toEqual(['بسم', 'الله']);
  });
});

describe('normalizeArabicWord', () => {
  it('strips marks, tatweel and zero-width chars', () => {
    expect(normalizeArabicWord('ٱلرَّحۡمَٰنِ')).toBe(normalizeArabicWord('الرحمن'));
  });

  it('unifies alef, ya and ta marbuta forms', () => {
    expect(normalizeArabicWord('إِسۡرَآءِيلَ')).toBe(normalizeArabicWord('اسرائيل'));
  });

  it('resolves a hamza carrier to its base letter', () => {
    expect(normalizeArabicWord('وَرَآئِ')).toBe(normalizeArabicWord('وراي'));
  });

  it('maps small waw/yeh to letters and collapses the elided duplicate', () => {
    expect(normalizeArabicWord('لِيَسُـۥٓـُٔوا۟')).toBe(normalizeArabicWord('ليسوا'));
  });
});

describe('alignWordIndexes', () => {
  it('maps positions 1:1 for sequences that differ only in diacritics', () => {
    expect(alignWordIndexes(['ٱلنَّاسُ', 'ٱتَّقُواْ'], ['الناس', 'اتقوا'])).toEqual([0, 1]);
  });

  it('merges two local words into one API word', () => {
    expect(alignWordIndexes(['لو', 'ما', 'ك'], ['لوما', 'ك'])).toEqual([0, 2]);
  });

  it('maps one local word onto two API words', () => {
    expect(alignWordIndexes(['لوما', 'ك'], ['لو', 'ما', 'ك'])).toEqual([0, 0, 1]);
  });

  it('returns null when the sequences cannot be reconciled', () => {
    expect(alignWordIndexes(['ا', 'ب'], ['ا', 'ج'])).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(alignWordIndexes([], [])).toBeNull();
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

describe('findLetterAt', () => {
  const letters: LetterTiming[] = [
    [1, 1, 1, 8681, 9145, 1, 1],
    [1, 1, 2, 9145, 10985, 1, 0.998],
    [1, 1, 3, 10985, 11145, 1, 1],
    [1, 1, 4, 11145, 11705, 1, 1],
    [1, 1, 5, 11705, 12105, 1, 1],
    [1, 1, 6, 11705, 12105, 1, null],
  ];

  it('finds the letter sounding at a position', () => {
    expect(findLetterAt(letters, 9000)?.[2]).toBe(1);
    expect(findLetterAt(letters, 11000)?.[2]).toBe(3);
    // Letters 5 and 6 share a span (6 is silent); the binary search returns the
    // last entry whose start is not after the position.
    expect(findLetterAt(letters, 11900)?.[2]).toBe(6);
  });

  it('keeps a silent letter with a null confidence', () => {
    expect(findLetterAt(letters, 11900)?.[6]).toBeNull();
  });

  it('returns null before the first letter', () => {
    expect(findLetterAt(letters, 10)).toBeNull();
  });
});

describe('wordOccurrenceKey', () => {
  it('distinguishes repeated occurrences of the same word', () => {
    expect(wordOccurrenceKey(1, 10, 1)).not.toBe(wordOccurrenceKey(1, 10, 2));
    expect(wordOccurrenceKey(1, 10, 1)).toBe('1:10:1');
  });
});
