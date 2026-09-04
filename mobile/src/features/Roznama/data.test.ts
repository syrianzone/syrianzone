import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchWeather } from '@/lib/home/widgets';

import { loadRoznamaPrayerSchedule, loadRoznamaWeather } from './data';

jest.mock('@/lib/home/widgets', () => ({
  fetchWeather: jest.fn(),
}));

function response(payload: unknown, ok = true): Response {
  return {
    json: jest.fn(async () => payload),
    ok,
    status: ok ? 200 : 503,
  } as unknown as Response;
}

function failing(): jest.Mock {
  return jest.fn(async () => response({ message: 'تعذر تحميل المواقيت' }, false));
}

const sitePrayerPayload = {
  governorate: 'damascus',
  hijri: { day: '22', month: 'رَبيع الأوّل', year: '1448' },
  timings: {
    Asr: '16:10',
    Dhuhr: '12:34',
    Fajr: '04:45',
    Isha: '20:17',
    Maghrib: '18:57',
    Sunrise: '06:11',
  },
};

function aladhanPayload(timings: Record<string, string>): unknown {
  return {
    code: 200,
    data: {
      date: { hijri: { day: '22', month: { ar: 'رَبيع الأوّل' }, year: '1448' } },
      timings,
    },
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

describe('Roznama prayer schedule', () => {
  test('reads the site prayer-times proxy before touching Aladhan', async () => {
    const fetcher = jest.fn(async () => response(sitePrayerPayload));

    await expect(
      loadRoznamaPrayerSchedule('damascus', new Date(2026, 8, 4), undefined, fetcher),
    ).resolves.toEqual({
      cached: false,
      value: {
        hijriDate: '22 رَبيع الأوّل 1448',
        timings: sitePrayerPayload.timings,
      },
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    expect(calls[0]?.[0]).toBe(
      'https://syrian.zone/api/prayer-times?governorate=damascus',
    );
  });

  test('falls back to Aladhan with the Muslim World League method', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response({ message: 'down' }, false))
      .mockResolvedValueOnce(
        response(aladhanPayload({ Fajr: '04:45', Isha: '20:17' })),
      );

    await expect(
      loadRoznamaPrayerSchedule('damascus', new Date(2026, 8, 4), undefined, fetcher),
    ).resolves.toMatchObject({
      cached: false,
      value: { hijriDate: '22 رَبيع الأوّل 1448', timings: { Fajr: '04:45' } },
    });

    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    expect(calls[1]?.[0]).toContain('/04-09-2026');
    expect(calls[1]?.[0]).toContain('method=3');
  });

  test('trims the timezone suffix Aladhan appends to its timings', async () => {
    const fetcher = jest
      .fn()
      .mockResolvedValueOnce(response({ message: 'down' }, false))
      .mockResolvedValueOnce(
        response(
          aladhanPayload({
            Asr: '16:10 (EEST)',
            Fajr: '04:45 (EEST)',
            Isha: '20:17 (EEST)',
          }),
        ),
      );

    const schedule = await loadRoznamaPrayerSchedule(
      'damascus',
      new Date(2026, 8, 4),
      undefined,
      fetcher,
    );

    expect(schedule.value.timings).toEqual({
      Asr: '16:10',
      Fajr: '04:45',
      Isha: '20:17',
    });
  });

  test('asks the site for a known governorate when the stored one is stale', async () => {
    const fetcher = jest.fn(async () => response(sitePrayerPayload));

    await loadRoznamaPrayerSchedule(
      'atlantis',
      new Date(2026, 8, 4),
      undefined,
      fetcher,
    );

    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    expect(calls[0]?.[0]).toContain('governorate=damascus');
  });

  test('uses cached prayer data after a safe refresh failure', async () => {
    const date = new Date(2026, 8, 4);
    await loadRoznamaPrayerSchedule(
      'damascus',
      date,
      undefined,
      jest.fn(async () => response(sitePrayerPayload)),
    );

    const failingFetch = jest.fn(async () => {
      throw new Error('private upstream body');
    });
    await expect(
      loadRoznamaPrayerSchedule('damascus', date, undefined, failingFetch),
    ).resolves.toMatchObject({
      cached: true,
      value: { hijriDate: '22 رَبيع الأوّل 1448' },
    });
  });

  test('reports prayer times as unavailable when nothing answers', async () => {
    await expect(
      loadRoznamaPrayerSchedule(
        'damascus',
        new Date(2026, 8, 4),
        undefined,
        failing(),
      ),
    ).rejects.toThrow('prayer_unavailable');
  });
});

describe('Roznama weather', () => {
  test('reads the site weather proxy by governorate before the worker', async () => {
    const fetcher = jest.fn(async () =>
      response({ description: 'clear sky', icon: '01n', temp: 26 }),
    );

    await expect(
      loadRoznamaWeather('aleppo', undefined, fetcher),
    ).resolves.toEqual({
      cached: false,
      value: { description: 'clear sky', icon: '01n', temperature: 26 },
    });

    expect(fetchWeather).not.toHaveBeenCalled();
    const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
    expect(calls[0]?.[0]).toBe(
      'https://syrian.zone/api/weather?governorate=aleppo',
    );
  });

  test('falls back to the worker and then to the last valid value', async () => {
    jest.mocked(fetchWeather).mockResolvedValueOnce({
      description: 'clear sky',
      icon: '01d',
      temperature: 29,
    });

    await expect(
      loadRoznamaWeather('damascus', undefined, failing()),
    ).resolves.toEqual({
      cached: false,
      value: { description: 'clear sky', icon: '01d', temperature: 29 },
    });
    expect(fetchWeather).toHaveBeenCalledWith(33.5138, 36.2765, undefined);

    jest.mocked(fetchWeather).mockRejectedValueOnce(new Error('private response'));
    await expect(
      loadRoznamaWeather('damascus', undefined, failing()),
    ).resolves.toMatchObject({ cached: true, value: { temperature: 29 } });
  });
});
