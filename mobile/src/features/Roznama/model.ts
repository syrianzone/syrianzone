import {
  getNextPrayer,
  type PrayerTimes,
} from '@/lib/ported/home';

export interface SyrianHoliday {
  date: Date;
  description: string;
  id: string;
  isNew?: boolean;
  nameAr: string;
  nameEn: string;
}

export interface UpcomingHoliday extends SyrianHoliday {
  daysLeft: number;
}

export type PrayerEventKey = keyof PrayerTimes;

export interface PrayerEvent {
  isPrayer: boolean;
  key: PrayerEventKey;
  label: string;
  time: string;
}

export interface ActiveAndNextPrayer {
  active: PrayerEvent;
  next: PrayerEvent;
  remainingMs: number;
}

export type WeatherIconFamily =
  | 'cloud'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'sun'
  | 'wind';

export interface WidgetQueryPresentation {
  cached: boolean;
  error: boolean;
  loading: boolean;
}

const VARIABLE_HOLIDAYS: Readonly<
  Record<number, Readonly<Record<string, { day: number; month: number }>>>
> = {
  2026: {
    'eastern-easter': { day: 12, month: 4 },
    'eid-adha': { day: 27, month: 5 },
    'eid-fitr': { day: 20, month: 3 },
    'hijri-new-year': { day: 16, month: 6 },
    mawlid: { day: 26, month: 8 },
    'western-easter': { day: 5, month: 4 },
  },
  2027: {
    'eastern-easter': { day: 2, month: 5 },
    'eid-adha': { day: 16, month: 5 },
    'eid-fitr': { day: 10, month: 3 },
    'hijri-new-year': { day: 6, month: 6 },
    mawlid: { day: 15, month: 8 },
    'western-easter': { day: 28, month: 3 },
  },
};

const PRAYER_EVENTS: readonly Omit<PrayerEvent, 'time'>[] = [
  { isPrayer: true, key: 'Fajr', label: 'الفجر' },
  { isPrayer: false, key: 'Sunrise', label: 'الشروق' },
  { isPrayer: true, key: 'Dhuhr', label: 'الظهر' },
  { isPrayer: true, key: 'Asr', label: 'العصر' },
  { isPrayer: true, key: 'Maghrib', label: 'المغرب' },
  { isPrayer: true, key: 'Isha', label: 'العشاء' },
];

const WEATHER_TRANSLATIONS: Readonly<Record<string, string>> = {
  'broken clouds': 'غيوم جزئية',
  'clear sky': 'سماء صافية',
  'few clouds': 'غيوم قليلة',
  'light rain': 'مطر خفيف',
  mist: 'ضباب',
  'moderate rain': 'مطر متوسط',
  'overcast clouds': 'غيوم ملبدة',
  rain: 'ممطر',
  'scattered clouds': 'غيوم متفرقة',
  'shower rain': 'مطر غزير',
  snow: 'مثلج',
  thunderstorm: 'عاصفة رعدية',
};

function fixedHolidays(year: number): SyrianHoliday[] {
  return [
    {
      date: new Date(year, 0, 1),
      description: 'بداية العام الميلادي الجديد',
      id: 'new-year',
      nameAr: 'رأس السنة الميلادية',
      nameEn: "New Year's Day",
    },
    {
      date: new Date(year, 2, 18),
      description:
        'ذكرى انطلاق الثورة السورية عام 2011، اعتمد كعيد وطني رسمي بموجب المرسوم 188 لعام 2025.',
      id: 'revolution-day',
      isNew: true,
      nameAr: 'عيد الثورة السورية',
      nameEn: 'Syrian Revolution Day',
    },
    {
      date: new Date(year, 2, 21),
      description: 'تكريم للأم ودورها في المجتمع.',
      id: 'mothers-day',
      nameAr: 'عيد الأم',
      nameEn: "Mother's Day",
    },
    {
      date: new Date(year, 3, 17),
      description: 'ذكرى جلاء آخر جندي فرنسي عن الأراضي السورية عام 1946.',
      id: 'evacuation-day',
      nameAr: 'عيد الجلاء',
      nameEn: 'Evacuation Day',
    },
    {
      date: new Date(year, 4, 1),
      description: 'تكريم للعمال وجهودهم.',
      id: 'workers-day',
      nameAr: 'عيد العمال العالمي',
      nameEn: "International Workers' Day",
    },
    {
      date: new Date(year, 11, 8),
      description:
        'العيد الوطني الجديد المعتمد بموجب المرسوم 188 لعام 2025 احتفاءً بسقوط الاستبداد عام 2024.',
      id: 'liberation-day',
      isNew: true,
      nameAr: 'عيد التحرير الوطني',
      nameEn: 'National Liberation Day',
    },
    {
      date: new Date(year, 11, 25),
      description: 'ذكرى ميلاد السيد المسيح عليه السلام.',
      id: 'christmas',
      nameAr: 'عيد الميلاد المجيد',
      nameEn: 'Christmas Day',
    },
  ];
}

function variableHolidays(year: number): SyrianHoliday[] {
  const dates = VARIABLE_HOLIDAYS[year];
  if (!dates) {
    return [];
  }
  const at = (id: string): Date => {
    const date = dates[id];
    if (!date) {
      throw new Error(`Missing variable holiday ${id} for ${year}`);
    }
    return new Date(year, date.month - 1, date.day);
  };
  return [
    {
      date: at('eid-fitr'),
      description: 'عطلة عيد الفطر السعيد (3 أيام).',
      id: 'eid-fitr',
      nameAr: 'عيد الفطر السعيد',
      nameEn: 'Eid al-Fitr',
    },
    {
      date: at('eid-adha'),
      description: 'عطلة عيد الأضحى المبارك (4 أيام).',
      id: 'eid-adha',
      nameAr: 'عيد الأضحى المبارك',
      nameEn: 'Eid al-Adha',
    },
    {
      date: at('hijri-new-year'),
      description: 'رأس السنة الهجرية الجديدة.',
      id: 'hijri-new-year',
      nameAr: 'رأس السنة الهجرية',
      nameEn: 'Islamic New Year',
    },
    {
      date: at('mawlid'),
      description: 'ذكرى المولد النبوي الشريف.',
      id: 'mawlid',
      nameAr: 'المولد النبوي الشريف',
      nameEn: "Prophet's Birthday",
    },
    {
      date: at('western-easter'),
      description: 'عيد الفصح المجيد (التقويم الغربي).',
      id: 'western-easter',
      nameAr: 'عيد الفصح المجيد (غربي)',
      nameEn: 'Western Easter',
    },
    {
      date: at('eastern-easter'),
      description: 'عيد الفصح المجيد (التقويم الشرقي).',
      id: 'eastern-easter',
      nameAr: 'عيد الفصح المجيد (شرقي)',
      nameEn: 'Eastern Easter',
    },
  ];
}

export function buildSyrianHolidays(year: number): SyrianHoliday[] {
  return [...fixedHolidays(year), ...variableHolidays(year)].sort(
    (left, right) => left.date.getTime() - right.date.getTime(),
  );
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function findNextHoliday(now: Date): UpcomingHoliday {
  const today = startOfLocalDay(now);
  const thisYear = buildSyrianHolidays(now.getFullYear());
  const holiday =
    thisYear.find((item) => item.date >= today) ??
    buildSyrianHolidays(now.getFullYear() + 1)[0];
  if (!holiday) {
    throw new Error('No Syrian holidays configured');
  }
  return {
    ...holiday,
    daysLeft: Math.ceil(
      (holiday.date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
    ),
  };
}

export function filterPassedHolidays(
  holidays: readonly SyrianHoliday[],
  now: Date,
  hidePassed: boolean,
): SyrianHoliday[] {
  if (!hidePassed) {
    return [...holidays];
  }
  const today = startOfLocalDay(now);
  return holidays.filter((holiday) => holiday.date >= today);
}

function prayerDate(now: Date, time: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
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

export function getActiveAndNextPrayer(
  prayerTimes: PrayerTimes,
  now: Date,
): ActiveAndNextPrayer | null {
  const datedEvents = PRAYER_EVENTS.flatMap((event) => {
    const time = prayerTimes[event.key];
    const date = time ? prayerDate(now, time) : null;
    return time && date ? [{ ...event, date, time }] : [];
  }).sort((left, right) => left.date.getTime() - right.date.getTime());
  const next = getNextPrayer(prayerTimes, now);
  if (!next || datedEvents.length === 0) {
    return null;
  }
  const nextIndex = datedEvents.findIndex((event) => event.key === next.key);
  const activeIndex =
    nextIndex <= 0 ? datedEvents.length - 1 : nextIndex - 1;
  const active = datedEvents[activeIndex];
  const nextEvent = datedEvents[nextIndex < 0 ? 0 : nextIndex];
  if (!active || !nextEvent) {
    return null;
  }
  return {
    active: {
      isPrayer: active.isPrayer,
      key: active.key,
      label: active.label,
      time: active.time,
    },
    next: {
      isPrayer: nextEvent.isPrayer,
      key: nextEvent.key,
      label: nextEvent.label,
      time: nextEvent.time,
    },
    remainingMs: next.remainingMs,
  };
}

export function getWeatherPresentation(
  description: string,
  iconCode: string,
): { descriptionAr: string; icon: WeatherIconFamily } {
  let icon: WeatherIconFamily = 'sun';
  if (iconCode.startsWith('03') || iconCode.startsWith('04')) {
    icon = 'cloud';
  } else if (iconCode.startsWith('09') || iconCode.startsWith('10')) {
    icon = 'rain';
  } else if (iconCode.startsWith('11')) {
    icon = 'storm';
  } else if (iconCode.startsWith('13')) {
    icon = 'snow';
  } else if (iconCode.startsWith('50')) {
    icon = 'wind';
  }
  return {
    descriptionAr: WEATHER_TRANSLATIONS[description] ?? description,
    icon,
  };
}

export function getWidgetQueryPresentation({
  fetchStatus,
  hasData,
  isError,
  isPending,
}: {
  fetchStatus: 'fetching' | 'idle' | 'paused';
  hasData: boolean;
  isError: boolean;
  isPending: boolean;
}): WidgetQueryPresentation {
  const unavailable = isError || fetchStatus === 'paused';
  return {
    cached: hasData && unavailable,
    error: !hasData && unavailable,
    loading: isPending && fetchStatus !== 'paused',
  };
}

export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}
