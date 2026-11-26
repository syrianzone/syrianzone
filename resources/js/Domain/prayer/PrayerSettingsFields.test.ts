import { describe, expect, it } from 'vitest';
import { coordinateError } from './PrayerSettingsFields';

describe('coordinateError', () => {
  it('accepts empty, partial and in-range values', () => {
    for (const v of ['', '-', '33.', '33.51', '-12.5', '90']) {
      expect(coordinateError(v, 90)).toBeNull();
    }
    expect(coordinateError('-180', 180)).toBeNull();
  });

  it('flags non-numbers and out-of-range values', () => {
    expect(coordinateError('abc', 90)).not.toBeNull();
    expect(coordinateError('91', 90)).not.toBeNull();
    expect(coordinateError('-180.5', 180)).not.toBeNull();
  });
});
