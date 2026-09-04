import { DEFAULT_QUESTIONS, SCALES } from './data';
import {
  calculateCompassResults,
  compassPercentage,
  compassRating,
  gaugeMarkerPercent,
  shuffleQuestions,
} from './model';

describe('Syria compass scoring', () => {
  test('preserves the source normalization and effect direction', () => {
    const questions = DEFAULT_QUESTIONS.slice(0, 2);
    const result = calculateCompassResults(questions, { 0: 2, 1: 2 });
    expect(result.auth_lib).toBe(0);

    const positive = calculateCompassResults([questions[1]!], { 0: 2 });
    expect(positive.auth_lib).toBe(1);
    expect(compassRating(1, SCALES[0]!)).toContain(SCALES[0]!.left);
  });

  test('uses a Fisher-Yates shuffle without changing the source array', () => {
    const original = DEFAULT_QUESTIONS.slice(0, 3);
    const shuffled = shuffleQuestions(original, () => 0);
    expect(shuffled.map((item) => item.id)).toEqual([2, 3, 1]);
    expect(original.map((item) => item.id)).toEqual([1, 2, 3]);
  });

  test('mirrors the gauge marker offset per writing direction', () => {
    expect(compassPercentage(1)).toBe(100);
    expect(compassPercentage(-4)).toBe(0);
    expect(gaugeMarkerPercent(1, 'rtl')).toBe(100);
    expect(gaugeMarkerPercent(1, 'ltr')).toBe(0);
    expect(gaugeMarkerPercent(0, 'rtl')).toBe(gaugeMarkerPercent(0, 'ltr'));
  });
});
