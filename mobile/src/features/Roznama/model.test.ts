import type { PrayerTimes } from '@/lib/ported/home';

import {
  buildSyrianHolidays,
  filterPassedHolidays,
  findNextHoliday,
  getActiveAndNextPrayer,
  getWidgetQueryPresentation,
  getWeatherPresentation,
  parseLocalDate,
} from './model';

describe('Syrian calendar model', () => {
  test('keeps the fixed and variable 2026 holiday dates', () => {
    const holidays = buildSyrianHolidays(2026);

    expect(holidays).toHaveLength(13);
    expect(
      holidays.map((holiday) => [holiday.id, holiday.date.getMonth() + 1, holiday.date.getDate()]),
    ).toEqual([
      ['new-year', 1, 1],
      ['revolution-day', 3, 18],
      ['eid-fitr', 3, 20],
      ['mothers-day', 3, 21],
      ['western-easter', 4, 5],
      ['eastern-easter', 4, 12],
      ['evacuation-day', 4, 17],
      ['workers-day', 5, 1],
      ['eid-adha', 5, 27],
      ['hijri-new-year', 6, 16],
      ['mawlid', 8, 26],
      ['liberation-day', 12, 8],
      ['christmas', 12, 25],
    ]);
  });

  test('keeps only fixed holidays when the source has no variable-year table', () => {
    const holidays = buildSyrianHolidays(2028);

    expect(holidays).toHaveLength(7);
    expect(holidays.map((holiday) => holiday.id)).toEqual([
      'new-year',
      'revolution-day',
      'mothers-day',
      'evacuation-day',
      'workers-day',
      'liberation-day',
      'christmas',
    ]);
  });

  test('finds the next holiday today and across the year boundary', () => {
    expect(findNextHoliday(new Date(2026, 2, 18, 18, 30)).id).toBe(
      'revolution-day',
    );
    expect(findNextHoliday(new Date(2026, 11, 26, 12)).id).toBe('new-year');
    expect(findNextHoliday(new Date(2026, 11, 26, 12)).daysLeft).toBe(6);
  });

  test('hides only holidays before the local start of today', () => {
    const now = new Date(2026, 2, 20, 23, 59);
    const visible = filterPassedHolidays(buildSyrianHolidays(2026), now, true);

    expect(visible[0]?.id).toBe('eid-fitr');
    expect(filterPassedHolidays(buildSyrianHolidays(2026), now, false)).toHaveLength(13);
  });
});

describe('Roznama daily widgets', () => {
  const prayerTimes: PrayerTimes = {
    Asr: '15:30',
    Dhuhr: '12:15',
    Fajr: '05:00',
    Isha: '19:30',
    Maghrib: '18:00',
    Sunrise: '06:30',
  };

  test('rolls the prayer countdown from Isha to tomorrow Fajr', () => {
    const state = getActiveAndNextPrayer(prayerTimes, new Date(2026, 6, 16, 20));

    expect(state?.active.key).toBe('Isha');
    expect(state?.next.key).toBe('Fajr');
    expect(state?.remainingMs).toBe(9 * 60 * 60 * 1000);
  });

  test('uses yesterday Isha as active before the first event', () => {
    const state = getActiveAndNextPrayer(prayerTimes, new Date(2026, 6, 16, 4));

    expect(state?.active.key).toBe('Isha');
    expect(state?.next.key).toBe('Fajr');
    expect(state?.remainingMs).toBe(60 * 60 * 1000);
  });

  test('translates weather and maps native icon families', () => {
    expect(getWeatherPresentation('light rain', '10d')).toEqual({
      descriptionAr: 'مطر خفيف',
      icon: 'rain',
    });
    expect(getWeatherPresentation('unknown weather', '50n')).toEqual({
      descriptionAr: 'unknown weather',
      icon: 'wind',
    });
  });

  test('parses event dates at local midnight instead of UTC', () => {
    const date = parseLocalDate('2026-07-16');

    expect(date).toEqual(new Date(2026, 6, 16));
    expect(parseLocalDate('2026-13-40')).toBeNull();
  });

  test('turns paused offline queries into error or cached states', () => {
    expect(
      getWidgetQueryPresentation({
        fetchStatus: 'paused',
        hasData: false,
        isError: false,
        isPending: true,
      }),
    ).toEqual({ cached: false, error: true, loading: false });
    expect(
      getWidgetQueryPresentation({
        fetchStatus: 'paused',
        hasData: true,
        isError: false,
        isPending: false,
      }),
    ).toEqual({ cached: true, error: false, loading: false });
  });
});
