/** Shared types and helpers for Ramadan imsakiya and monthly prayer timetables. */

export interface MonthlyPrayerDay {
  date: string;
  gregorian_day: number;
  weekday_ar: string;
  hijri_day: string;
  hijri_month: string;
  hijri_year: string;
  timings: Record<string, string>;
}

export interface MonthlyPrayerCalendar {
  year: number;
  month: number;
  month_ar: string;
  days: MonthlyPrayerDay[];
}

export interface QiblaInfo {
  degrees: number;
  direction_ar: string;
  description_ar: string;
}

export interface TodaySyriaInfo {
  iso: string;
  gregorian_ar: string;
}

export interface ImsakiyaMeta {
  hijri_year: number;
  method: number;
  source: string;
  timezone: string;
  generated_at: string;
  expected_start_date: string;
  expected_end_date: string;
  days_count: number;
  day_offset: number;
  minute_offset: number;
  official_source_url: string | null;
}

export interface ImsakiyaRow {
  hijri_day: number;
  date: string;
  weekday_ar: string;
  imsak: string;
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
}

export interface RamadanImageCredit {
  id: string;
  file: string;
  width: number;
  height: number;
  alt_ar: string;
  caption_ar: string;
  source_article_url: string;
  source_image_url: string;
  credit_ar: string;
}

/** Whole calendar days from `fromIso` (YYYY-MM-DD) to `targetIso` (YYYY-MM-DD). */
export function daysBetweenIso(fromIso: string, targetIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const target = Date.parse(`${targetIso}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(target)) return 0;
  return Math.round((target - from) / 86_400_000);
}

export interface RamadanCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  started: boolean;
}

/** Live countdown to expected Ramadan start in Syria (+03:00). */
export function computeRamadanCountdown(expectedStartIso: string, now: Date): RamadanCountdown {
  const targetMs = Date.parse(`${expectedStartIso}T00:00:00+03:00`);
  if (Number.isNaN(targetMs)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, started: false };
  }
  const diff = targetMs - now.getTime();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, started: false };
}
