import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchWeather } from '@/lib/home/widgets';

import {
  loadRoznamaPrayerSchedule,
  loadRoznamaWeather,
} from './data';

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

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

test('reuses the Home weather request and falls back to its last valid value', async () => {
  jest.mocked(fetchWeather).mockResolvedValueOnce({
    description: 'clear sky',
    icon: '01d',
    temperature: 29,
  });

  await expect(loadRoznamaWeather('damascus')).resolves.toEqual({
    cached: false,
    value: {
      description: 'clear sky',
      icon: '01d',
      temperature: 29,
    },
  });

  jest.mocked(fetchWeather).mockRejectedValueOnce(new Error('private response'));
  await expect(loadRoznamaWeather('damascus')).resolves.toMatchObject({
    cached: true,
    value: { temperature: 29 },
  });
  expect(fetchWeather).toHaveBeenCalledWith(33.5138, 36.2765, undefined);
});

test('keeps Aladhan timings and the API Hijri date in one validated value', async () => {
  const fetcher = jest.fn(async () =>
    response({
      code: 200,
      data: {
        date: {
          hijri: {
            day: '1',
            month: { ar: 'مُحَرَّم' },
            year: '1448',
          },
        },
        timings: {
          Asr: '15:30',
          Dhuhr: '12:15',
          Fajr: '05:00',
          Isha: '19:30',
          Maghrib: '18:00',
          Sunrise: '06:30',
        },
      },
    }),
  );

  await expect(
    loadRoznamaPrayerSchedule('damascus', new Date(2026, 6, 16), undefined, fetcher),
  ).resolves.toMatchObject({
    cached: false,
    value: {
      hijriDate: '1 مُحَرَّم 1448',
      timings: { Fajr: '05:00', Isha: '19:30' },
    },
  });

  const calls = fetcher.mock.calls as unknown as [string, RequestInit?][];
  expect(calls[0]?.[0]).toContain('/16-07-2026');
  expect(calls[0]?.[0]).toContain('method=3');
});

test('uses cached prayer data after a safe refresh failure', async () => {
  const successfulFetch = jest.fn(async () =>
    response({
      code: 200,
      data: {
        date: { hijri: { day: '1', month: { ar: 'محرم' }, year: '1448' } },
        timings: { Fajr: '05:00' },
      },
    }),
  );
  const date = new Date(2026, 6, 16);
  await loadRoznamaPrayerSchedule('damascus', date, undefined, successfulFetch);

  const failingFetch = jest.fn(async () => {
    throw new Error('private upstream body');
  });
  await expect(
    loadRoznamaPrayerSchedule('damascus', date, undefined, failingFetch),
  ).resolves.toMatchObject({ cached: true, value: { hijriDate: '1 محرم 1448' } });
});
