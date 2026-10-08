import { describe, expect, it } from 'vitest';
import { ayahTimingMap, findAyahAt, pickAudioTier } from './quranAudio';
import type { AyahTiming } from './mp3quran';

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
