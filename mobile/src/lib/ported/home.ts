import { z } from 'zod';

export const governorates = [
  { id: 'damascus', ar: 'دمشق', en: 'Damascus', lat: 33.5138, lon: 36.2765 },
  { id: 'aleppo', ar: 'حلب', en: 'Aleppo', lat: 36.2021, lon: 37.1343 },
  { id: 'homs', ar: 'حمص', en: 'Homs', lat: 34.7324, lon: 36.7137 },
  { id: 'hama', ar: 'حماة', en: 'Hama', lat: 35.1318, lon: 36.7578 },
  { id: 'latakia', ar: 'اللاذقية', en: 'Latakia', lat: 35.5317, lon: 35.7901 },
  { id: 'tartus', ar: 'طرطوس', en: 'Tartus', lat: 34.889, lon: 35.8866 },
  {
    id: 'deir-ez-zor',
    ar: 'دير الزور',
    en: 'Deir ez-Zor',
    lat: 35.3359,
    lon: 40.1408,
  },
  { id: 'idlib', ar: 'إدلب', en: 'Idlib', lat: 35.9306, lon: 36.6339 },
  { id: 'daraa', ar: 'درعا', en: 'Daraa', lat: 32.6255, lon: 36.1016 },
  {
    id: 'quneitra',
    ar: 'القنيطرة',
    en: 'Quneitra',
    lat: 33.125,
    lon: 35.825,
  },
  { id: 'sweida', ar: 'السويداء', en: 'Sweida', lat: 32.7089, lon: 36.5695 },
  {
    id: 'rural-damascus',
    ar: 'ريف دمشق',
    en: 'Rural Damascus',
    lat: 33.5138,
    lon: 36.2765,
  },
  { id: 'hasakah', ar: 'الحسكة', en: 'Hasakah', lat: 36.5023, lon: 40.7382 },
  { id: 'raqqa', ar: 'الرقة', en: 'Raqqa', lat: 35.952, lon: 39.0081 },
] as const;

export const searchEngines = [
  'duckduckgo',
  'searx',
  'google',
  'bing',
  'custom',
] as const;

const safeHttpUrl = z.string().trim().max(2048).refine((value) => {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) {
    return false;
  }
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
});

export const customLinkSchema = z
  .object({
    icon: z.string().trim().min(1).max(12).default('🔗'),
    id: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(80),
    url: safeHttpUrl,
  })
  .strict();

export const homeCoordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

export type CustomLink = z.infer<typeof customLinkSchema>;
export type HomeCoordinates = z.infer<typeof homeCoordinatesSchema>;

export const homeSettingsSchema = z.object({
  clockFormat: z.enum(['12', '24']).default('24'),
  governorate: z.string().default('damascus'),
  searchEngine: z.enum(searchEngines).default('duckduckgo'),
  customCoordinates: homeCoordinatesSchema.nullable().default(null),
  customLinks: z.array(customLinkSchema).max(24).default([]),
  customSearchUrl: z.string().trim().max(2048).default(''),
  showClock: z.boolean().default(true),
  showEvents: z.boolean().default(true),
  showPrayerTimes: z.boolean().default(true),
  showSearch: z.boolean().default(true),
  showWeather: z.boolean().default(true),
  useCustomCoordinates: z.boolean().default(false),
});

export type HomeSettings = z.infer<typeof homeSettingsSchema>;

export const defaultHomeSettings: HomeSettings = homeSettingsSchema.parse({});

export interface PrayerTimes {
  Asr?: string;
  Dhuhr?: string;
  Fajr?: string;
  Isha?: string;
  Maghrib?: string;
  Sunrise?: string;
}

export interface NextPrayer {
  key: keyof PrayerTimes;
  labelAr: string;
  labelEn: string;
  remainingMs: number;
  time: string;
}

const prayerOrder: readonly {
  key: keyof PrayerTimes;
  labelAr: string;
  labelEn: string;
}[] = [
  { key: 'Fajr', labelAr: 'الفجر', labelEn: 'Fajr' },
  { key: 'Sunrise', labelAr: 'الشروق', labelEn: 'Sunrise' },
  { key: 'Dhuhr', labelAr: 'الظهر', labelEn: 'Dhuhr' },
  { key: 'Asr', labelAr: 'العصر', labelEn: 'Asr' },
  { key: 'Maghrib', labelAr: 'المغرب', labelEn: 'Maghrib' },
  { key: 'Isha', labelAr: 'العشاء', labelEn: 'Isha' },
];

function eventDate(now: Date, value: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  const date = new Date(now);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function getNextPrayer(
  times: PrayerTimes,
  now: Date,
): NextPrayer | null {
  const events = prayerOrder.flatMap((prayer) => {
    const value = times[prayer.key];
    const date = value ? eventDate(now, value) : null;
    return value && date ? [{ ...prayer, date, time: value }] : [];
  });
  if (events.length === 0) {
    return null;
  }

  const next = events.find((event) => event.date.getTime() > now.getTime());
  if (next) {
    return {
      key: next.key,
      labelAr: next.labelAr,
      labelEn: next.labelEn,
      remainingMs: next.date.getTime() - now.getTime(),
      time: next.time,
    };
  }

  const tomorrow = new Date(events[0]?.date ?? now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const first = events[0];
  return first
    ? {
        key: first.key,
        labelAr: first.labelAr,
        labelEn: first.labelEn,
        remainingMs: tomorrow.getTime() - now.getTime(),
        time: first.time,
      }
    : null;
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function buildSearchUrl(
  engine: HomeSettings['searchEngine'],
  query: string,
  customSearchUrl = '',
): string | null {
  const value = query.trim();
  if (!value) {
    return null;
  }
  const templates = {
    bing: 'https://www.bing.com/search?q=%s',
    duckduckgo: 'https://duckduckgo.com/?q=%s',
    google: 'https://www.google.com/search?q=%s',
    searx: 'https://searx.be/search?q=%s',
  } as const;
  return buildSearchUrlFromTemplate(
    engine === 'custom' ? customSearchUrl : templates[engine],
    value,
  );
}

export function buildSearchUrlFromTemplate(
  template: string | undefined,
  query: string,
): string | null {
  const value = query.trim();
  const normalized = normalizeSearchTemplate(template ?? '');
  if (!value || !normalized) {
    return null;
  }
  const encoded = encodeURIComponent(value);
  return normalized.includes('%s')
    ? normalized.replace('%s', encoded)
    : `${normalized}${encoded}`;
}

export function normalizeSearchTemplate(value: string): string | null {
  const candidate = value.trim();
  if (!candidate || candidate.length > 2048 || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return null;
  }
  try {
    const url = new URL(candidate.replace('%s', 'query'));
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
      ? candidate
      : null;
  } catch {
    return null;
  }
}

export function parseCoordinates(
  latitude: string,
  longitude: string,
): HomeCoordinates | null {
  if (!latitude.trim() || !longitude.trim()) {
    return null;
  }
  const parsed = homeCoordinatesSchema.safeParse({
    latitude: Number(latitude),
    longitude: Number(longitude),
  });
  return parsed.success ? parsed.data : null;
}

export function resolveHomeCoordinates(
  settings: HomeSettings,
): HomeCoordinates {
  if (settings.useCustomCoordinates && settings.customCoordinates) {
    return settings.customCoordinates;
  }
  const governorate =
    governorates.find((item) => item.id === settings.governorate) ??
    governorates[0];
  return { latitude: governorate.lat, longitude: governorate.lon };
}

export function formatHijriDate(date: Date, locale: 'ar' | 'en'): string {
  const format = (calendar: 'islamic' | 'islamic-umalqura') =>
    new Intl.DateTimeFormat(
      locale === 'ar'
        ? `ar-SY-u-ca-${calendar}`
        : `en-US-u-ca-${calendar}`,
      { day: 'numeric', month: 'long', year: 'numeric' },
    ).format(date);

  try {
    const value = format('islamic-umalqura');
    if (locale === 'ar') {
      return value.includes('هـ') ? value : `${value} هـ`;
    }
    return value.includes('AH') ? value : `${value} AH`;
  } catch {
    try {
      const value = format('islamic');
      if (locale === 'ar') {
        return value.includes('هـ') ? value : `${value} هـ`;
      }
      return value.includes('AH') ? value : `${value} AH`;
    } catch {
      return '';
    }
  }
}
