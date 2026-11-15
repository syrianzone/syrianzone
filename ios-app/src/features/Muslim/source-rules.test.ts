import { describe, expect, test } from 'bun:test';
import { alignWordIndexes, ayahAudioUrl, findAyahAt, findLetterAt, findWordAt, normalizeRecitationCode, recitationByCode, splitPartTokens, type LetterTiming, type WordTiming } from '../../platform/quran/source-rules';
import { prayerSchedule } from '../../platform/prayer-rules';

describe('unchanged Quran and prayer rule goldens', () => {
  test('preserves recitation migration and EveryAyah naming', () => {
    expect(normalizeRecitationCode('Husary_128kbps')).toBe('mahmoud-husary/r1');
    expect(normalizeRecitationCode('future/r1')).toBe('future/r1');
    expect(ayahAudioUrl(recitationByCode('husary'), 2, 255)).toBe('https://everyayah.com/data/Husary_128kbps/002255.mp3');
  });
  test('keeps text tokens lossless and timing gaps distinct from a repeated word', () => {
    const line = 'بِسْمِ  اللَّهِ ﴿١﴾';
    expect(splitPartTokens(line).map(token => token.kind === 'marker' ? `﴿${token.digits}﴾` : token.value).join('')).toBe(line);
    const words: WordTiming[] = [[1, 1, 0, 100, 1], [1, 1, 200, 300, 2]];
    expect(findWordAt(words, 250)?.[4]).toBe(2);
    expect(findWordAt(words, 150)).toBeNull();
    expect(findAyahAt([[1, 0, 100]], 100)).toBeNull();
    const letters: LetterTiming[] = [[1, 1, 1, 0, 100, 2, null]];
    expect(findLetterAt(letters, 50)?.[6]).toBeNull();
    expect(alignWordIndexes(['بِسْمِ', 'اللَّهِ'], ['بسم', 'الله'])).toEqual([0, 1]);
  });
  test('retains source exact-boundary, Sunrise and next-day prayer semantics', () => {
    const timings = { Fajr: '05:00', Sunrise: '06:15', Dhuhr: '12:00', Asr: '15:00', Maghrib: '18:00', Isha: '19:30' };
    const boundary = prayerSchedule(timings, new Date(2026, 10, 14, 5, 0));
    expect(boundary?.active?.key).toBe('Fajr');
    expect(boundary?.next?.key).toBe('Sunrise');
    expect(boundary?.next?.isPrayer).toBe(false);
    expect(prayerSchedule(timings, new Date(2026, 10, 14, 20, 0))?.next?.isTomorrow).toBe(true);
    expect(prayerSchedule(timings, new Date(2026, 10, 14, 20, 0), { rollover: false })?.next).toBeNull();
    expect(prayerSchedule(timings, new Date(2026, 10, 14, 5, 0), { includeSunrise: false })?.next?.key).toBe('Dhuhr');
  });
});
