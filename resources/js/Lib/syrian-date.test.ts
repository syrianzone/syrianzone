import { describe, expect, it } from 'vitest';
import { formatGregorianSyrianShort } from './syrian-date';

describe('formatGregorianSyrianShort', () => {
  it('reads a bare date as the calendar day, not as a UTC instant', () => {
    expect(formatGregorianSyrianShort('2026-09-10')).toBe('١٠ أيلول ٢٠٢٦');
  });

  it('prints a Date the way the page already holds it', () => {
    expect(formatGregorianSyrianShort(new Date(2026, 8, 10))).toBe('١٠ أيلول ٢٠٢٦');
  });

  it('takes a full timestamp as the instant it spells', () => {
    expect(formatGregorianSyrianShort('2026-09-10T12:00:00')).toBe('١٠ أيلول ٢٠٢٦');
  });

  it('returns an unparseable string unchanged, so a value is never blanked', () => {
    expect(formatGregorianSyrianShort('قيد التوثيق')).toBe('قيد التوثيق');
  });
});
