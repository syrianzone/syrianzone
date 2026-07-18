import {
  buildSearchUrl,
  customLinkSchema,
  formatDuration,
  formatHijriDate,
  getNextPrayer,
  homeSettingsSchema,
  parseCoordinates,
  resolveHomeCoordinates,
} from './home';

describe('home behavior', () => {
  test('selects the next prayer and rolls Fajr to tomorrow', () => {
    const times = { Fajr: '05:00', Dhuhr: '12:15', Isha: '20:30' };
    const midday = getNextPrayer(times, new Date('2026-07-15T12:00:00'));
    expect(midday).toMatchObject({ key: 'Dhuhr', remainingMs: 15 * 60 * 1000 });

    const late = getNextPrayer(times, new Date('2026-07-15T23:00:00'));
    expect(late).toMatchObject({ key: 'Fajr', remainingMs: 6 * 60 * 60 * 1000 });
  });

  test('formats the live countdown and search URL', () => {
    expect(formatDuration(3_661_999)).toBe('01:01:01');
    expect(buildSearchUrl('duckduckgo', ' سوريا اليوم ')).toBe(
      'https://duckduckgo.com/?q=%D8%B3%D9%88%D8%B1%D9%8A%D8%A7%20%D8%A7%D9%84%D9%8A%D9%88%D9%85',
    );
    expect(buildSearchUrl('google', '   ')).toBeNull();
    expect(
      buildSearchUrl(
        'custom',
        'Syria weather',
        'https://search.example/find/%s',
      ),
    ).toBe('https://search.example/find/Syria%20weather');
    expect(buildSearchUrl('custom', 'query', 'javascript:alert(%s)')).toBeNull();
  });

  test('migrates older preferences and validates personal links', () => {
    const settings = homeSettingsSchema.parse({
      governorate: 'aleppo',
      searchEngine: 'google',
    });

    expect(settings.customCoordinates).toBeNull();
    expect(settings.customLinks).toEqual([]);
    expect(settings.customSearchUrl).toBe('');
    expect(settings.useCustomCoordinates).toBe(false);
    expect(
      customLinkSchema.safeParse({
        icon: '📌',
        id: 'saved-link',
        name: 'Local guide',
        url: 'https://guide.example/syria',
      }).success,
    ).toBe(true);
    expect(
      customLinkSchema.safeParse({
        icon: '📌',
        id: 'unsafe-link',
        name: 'Unsafe',
        url: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(
      customLinkSchema.safeParse({
        icon: '📌',
        id: 'control-link',
        name: 'Control character',
        url: 'https://guide.example/\npath',
      }).success,
    ).toBe(false);
  });

  test('uses validated custom coordinates and falls back to the governorate', () => {
    expect(parseCoordinates('33.5138', '36.2765')).toEqual({
      latitude: 33.5138,
      longitude: 36.2765,
    });
    expect(parseCoordinates('91', '36')).toBeNull();
    expect(parseCoordinates('', '36')).toBeNull();

    const defaults = homeSettingsSchema.parse({ governorate: 'homs' });
    expect(resolveHomeCoordinates(defaults)).toEqual({
      latitude: 34.7324,
      longitude: 36.7137,
    });
    expect(
      resolveHomeCoordinates({
        ...defaults,
        customCoordinates: { latitude: 35.1, longitude: 36.8 },
        useCustomCoordinates: true,
      }),
    ).toEqual({ latitude: 35.1, longitude: 36.8 });
  });

  test('formats a Hijri date for both app languages', () => {
    const date = new Date('2026-07-16T12:00:00Z');
    expect(formatHijriDate(date, 'ar')).toContain('هـ');
    expect(formatHijriDate(date, 'en')).toContain('AH');
  });
});
