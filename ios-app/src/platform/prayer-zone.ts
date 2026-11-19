import { prayerKeys, prayerLabels, type PrayerMoment, type PrayerSchedule } from './prayer-rules';
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let result = formatters.get(zone);
  if (!result) { result = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); formatters.set(zone, result); }
  return result;
}
export function validTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 100) return false;
  try { formatter(value).format(new Date(0)); return true; } catch { return false; }
}
function parts(date: Date, zone: string): Record<string, number> { return Object.fromEntries(formatter(zone).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)])); }
export function zonedDay(date: Date, zone: string): string { const row = parts(date, zone); return `${row.year}-${String(row.month).padStart(2, '0')}-${String(row.day).padStart(2, '0')}`; }
function shiftDay(day: string, amount: number): string { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10); }
function instant(day: string, clock: string, zone: string): Date | null {
  const [year, month, date] = day.split('-').map(Number), [hour, minute] = clock.split(':').map(Number);
  if (year === undefined || month === undefined || date === undefined || hour === undefined || minute === undefined || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clock)) return null;
  const desired = Date.UTC(year, month - 1, date, hour, minute, 0);
  let candidate = desired;
  for (let count = 0; count < 4; count++) {
    const fields = parts(new Date(candidate), zone);
    if (fields.year === undefined || fields.month === undefined || fields.day === undefined || fields.hour === undefined || fields.minute === undefined || fields.second === undefined) return null;
    const observed = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second), difference = desired - observed;
    if (difference === 0) return new Date(candidate);
    candidate += difference;
  }
  return null;
}
export function prayerScheduleInZone(timings: Record<string, string> | null | undefined, now: Date, zone: string | null, day: string | null, options: { includeSunrise?: boolean; rollover?: boolean } = {}): PrayerSchedule | null {
  if (!timings || !validTimeZone(zone) || day !== zonedDay(now, zone)) return null;
  const moments: PrayerMoment[] = [];
  for (const key of prayerKeys) {
    if (key === 'Sunrise' && options.includeSunrise === false) continue;
    const time = timings[key], at = time ? instant(day, time, zone) : null;
    if (!at || !time) return null;
    moments.push({ key, label: prayerLabels[key], time, at, isPrayer: key !== 'Sunrise' });
  }
  moments.sort((a, b) => a.at.getTime() - b.at.getTime());
  const first = moments[0], last = moments.at(-1);
  if (!first || !last) return null;
  const nextIndex = moments.findIndex(moment => moment.at.getTime() > now.getTime());
  if (nextIndex < 0) {
    if (options.rollover === false) return { active: last, next: null, remainingMs: null };
    const at = instant(shiftDay(day, 1), first.time, zone); if (!at) return null;
    const remainingMs = Math.max(0, at.getTime() - now.getTime());
    return { active: last, next: { ...first, at, isTomorrow: true, remainingMs }, remainingMs };
  }
  const next = moments[nextIndex]; if (!next) return null;
  const prior = nextIndex === 0 ? instant(shiftDay(day, -1), last.time, zone) : null;
  const active = nextIndex === 0 ? prior ? { ...last, at: prior } : null : moments[nextIndex - 1] ?? null, remainingMs = Math.max(0, next.at.getTime() - now.getTime());
  return { active, next: { ...next, isTomorrow: false, remainingMs }, remainingMs };
}

// PORT STATUS: source resources/js/Domain/prayer/nextPrayer.ts; confidence high; todos 0. Native adaptation interprets selected-location clocks in their authoritative timezone.
