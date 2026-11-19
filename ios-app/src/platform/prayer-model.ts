import { finiteNumber, integer, record, text } from './validation';
import { prayerKeys, type PrayerKey } from './prayer-rules';
import { validTimeZone } from './prayer-zone';

export interface PrayerTimes {
  governorate: string; latitude: number; longitude: number; method: number;
  timings: Record<PrayerKey, string>; hijri: { day: string; month: string; year: string } | null;
  timezone?: string | null; date?: string;
}
export function decodePrayerTimes(value: unknown): PrayerTimes {
  const row = record(value), raw = record(row.timings);
  const timings = {} as Record<PrayerKey, string>;
  for (const key of prayerKeys) {
    const time = text(raw[key]);
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('مواقيت الصلاة غير صالحة.');
    timings[key] = time;
  }
  const latitude = finiteNumber(row.latitude), longitude = finiteNumber(row.longitude);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error('إحداثيات المواقيت غير صالحة.');
  const hijri = row.hijri == null ? null : record(row.hijri);
  const date = row.date === undefined ? undefined : text(row.date);
  if (date !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)) throw new Error('تاريخ المواقيت غير صالح.');
  if (row.timezone != null && !validTimeZone(row.timezone)) throw new Error('المنطقة الزمنية للمواقيت غير صالحة.');
  return { governorate: text(row.governorate), latitude, longitude, method: integer(row.method), timings, ...(date ? { date } : {}), ...(row.timezone !== undefined ? { timezone: row.timezone === null ? null : text(row.timezone) } : {}),
    hijri: hijri ? { day: text(hijri.day), month: text(hijri.month), year: text(hijri.year) } : null };
}

// PORT STATUS: source resources/js/Domain/prayer/times.ts; confidence high; todos 0.
