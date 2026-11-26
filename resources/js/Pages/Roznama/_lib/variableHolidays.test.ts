import { describe, expect, it } from 'vitest';
import {
  VARIABLE_HOLIDAYS_MAP, easternEaster, lunarHolidayDates, variableHolidays, westernEaster,
} from './variableHolidays';

describe('computus', () => {
  it('computes western Easter', () => {
    expect(westernEaster(2026)).toEqual({ month: 4, day: 5 });
    expect(westernEaster(2027)).toEqual({ month: 3, day: 28 });
    expect(westernEaster(2028)).toEqual({ month: 4, day: 16 });
  });

  it('computes eastern Easter on the Gregorian calendar', () => {
    expect(easternEaster(2026)).toEqual({ month: 4, day: 12 });
    expect(easternEaster(2027)).toEqual({ month: 5, day: 2 });
    expect(easternEaster(2028)).toEqual({ month: 4, day: 16 });
  });
});

describe('lunar holidays (Umm al-Qura)', () => {
  // The calendar is astronomical; the announced dates follow the moon
  // sighting, so they can differ by a day (2026's Mawlid: 25 vs 26 August).
  it('lands within a day of the reviewed 2026 and 2027 dates', () => {
    for (const year of [2026, 2027]) {
      const computed = lunarHolidayDates(year);
      const reviewed = VARIABLE_HOLIDAYS_MAP[year];
      for (const id of ['eid-fitr', 'eid-adha', 'hijri-new-year', 'mawlid'] as const) {
        const [got] = computed[id] ?? [];
        expect(got).toBeDefined();
        const diff = Date.UTC(year, got.month - 1, got.day) - Date.UTC(year, reviewed[id].month - 1, reviewed[id].day);
        expect(Math.abs(diff)).toBeLessThanOrEqual(86_400_000);
      }
    }
  });

  it('finds a Hijri date that falls twice in one Gregorian year', () => {
    expect(lunarHolidayDates(2008)['hijri-new-year']).toHaveLength(2);
  });
});

describe('variableHolidays', () => {
  it('prefers the reviewed table, and computes past it', () => {
    expect(variableHolidays(2026)['eid-fitr']).toEqual([{ month: 3, day: 20 }]);
    const y2030 = variableHolidays(2030);
    expect(y2030['eid-fitr']?.length).toBeGreaterThan(0);
    expect(y2030['western-easter']).toEqual([{ month: 4, day: 21 }]);
  });
});
