import { fetchPrayerTimes, fetchWeather } from './widgets';

function response(payload: unknown, ok = true): Response {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: jest.fn(async () => payload),
    ok,
    status: ok ? 200 : 503,
  } as unknown as Response;
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('validates and rounds the local weather response', async () => {
  const request = jest.spyOn(global, 'fetch').mockResolvedValue(
    response({
      main: { temp: 28.7 },
      weather: [{ description: 'clear sky', icon: '01d' }],
    }),
  );

  await expect(fetchWeather(33.5138, 36.2765)).resolves.toEqual({
    description: 'clear sky',
    icon: '01d',
    temperature: 29,
  });
  expect(request.mock.calls[0]?.[0]).toContain('lat=33.5138');
  expect(request.mock.calls[0]?.[0]).toContain('lon=36.2765');
});

test('rejects malformed prayer times and an unsuccessful API code', async () => {
  jest.spyOn(global, 'fetch').mockResolvedValueOnce(
    response({ code: 200, data: { timings: { Fajr: 'before sunrise' } } }),
  );
  await expect(
    fetchPrayerTimes(33.5138, 36.2765, new Date(2026, 6, 16)),
  ).rejects.toThrow();

  jest.spyOn(global, 'fetch').mockResolvedValueOnce(
    response({ code: 500, data: { timings: { Fajr: '05:00' } } }),
  );
  await expect(
    fetchPrayerTimes(33.5138, 36.2765, new Date(2026, 6, 16)),
  ).rejects.toThrow('Prayer response was not successful');
});

test('keeps valid prayer timing suffixes used by Aladhan', async () => {
  const request = jest.spyOn(global, 'fetch').mockResolvedValue(
    response({
      code: 200,
      data: {
        timings: {
          Dhuhr: '12:15',
          Fajr: '05:00 (EEST)',
        },
      },
    }),
  );

  await expect(
    fetchPrayerTimes(33.5138, 36.2765, new Date(2026, 6, 16)),
  ).resolves.toEqual({ Dhuhr: '12:15', Fajr: '05:00 (EEST)' });
  expect(request.mock.calls[0]?.[0]).toContain('/16-07-2026');
  expect(request.mock.calls[0]?.[0]).toContain('method=3');
});
