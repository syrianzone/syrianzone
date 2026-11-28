import { describe, expect, it } from 'vitest';
import { formatHijriDate } from './hijri';

describe('formatHijriDate', () => {
  it('prints the Hijri fallback with Western digits by default', () => {
    const hijri = formatHijriDate(new Date(Date.UTC(2026, 10, 26, 12)), 'Asia/Damascus');
    // An ICU build without the Islamic calendar returns '' (the documented fallback).
    if (hijri) {
      expect(hijri).toMatch(/\d/);
      expect(hijri).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    }
  });

  it('prints the Hijri fallback without Arabic-Indic digits when latn is passed', () => {
    const hijri = formatHijriDate(new Date(Date.UTC(2026, 10, 26, 12)), 'Asia/Damascus', 'latn');
    if (hijri) {
      expect(hijri).toMatch(/\d/);
      expect(hijri).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
    }
  });
});
