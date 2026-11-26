import { describe, expect, it } from 'vitest';
import { formatGregorianSyrian, formatGregorianSyrianShort, formatSyrianDateTime } from './syrian-date';

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

describe('Syrian time for instants', () => {
  it('reads a zoned timestamp in Damascus time, whatever the host zone', () => {
    // 22:30 UTC is already the next day in Damascus (UTC+3)
    expect(formatGregorianSyrianShort('2026-09-10T22:30:00Z')).toBe('١١ أيلول ٢٠٢٦');
    expect(formatSyrianDateTime('2026-09-10T22:30:00.000000Z')).toBe('١١ أيلول ٢٠٢٦، ٠١:٣٠');
    expect(formatSyrianDateTime('2026-09-10T14:30:00+03:00')).toBe('١٠ أيلول ٢٠٢٦، ١٤:٣٠');
  });

  it('reads a millisecond timestamp as an instant', () => {
    expect(formatSyrianDateTime(Date.UTC(2026, 8, 10, 11, 5))).toBe('١٠ أيلول ٢٠٢٦، ١٤:٠٥');
  });

  it('keeps a Date and a zoneless timestamp on their own wall clock', () => {
    expect(formatSyrianDateTime(new Date(2026, 8, 10, 9, 7))).toBe('١٠ أيلول ٢٠٢٦، ٠٩:٠٧');
    expect(formatSyrianDateTime('2026-09-10T09:07:00')).toBe('١٠ أيلول ٢٠٢٦، ٠٩:٠٧');
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatSyrianDateTime('not a date')).toBe('');
  });
});

describe('Western digits (latn), as /roznama prints them', () => {
  it('prints the long and short Gregorian dates in 0-9', () => {
    expect(formatGregorianSyrian(new Date(2026, 8, 10), 'latn')).toBe('الخميس، 10 أيلول 2026');
    expect(formatGregorianSyrianShort('2026-09-10', 'latn')).toBe('10 أيلول 2026');
  });

  it('keeps Arabic-Indic digits by default for the other pages', () => {
    expect(formatGregorianSyrian(new Date(2026, 8, 10))).toBe('الخميس، ١٠ أيلول ٢٠٢٦');
  });
});
