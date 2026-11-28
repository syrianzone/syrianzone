import type { DateDigits } from '@/Lib/syrian-date';
import type { PrayerHijri } from './times';

/**
 * Hijri dates. The timings endpoint already returns the Umm al-Qura date it
 * computed, so `hijriDateLabel` is the primary path; `formatHijriDate` is the
 * client-side fallback for the surfaces that print today's date before (or
 * instead of) that response.
 */

/**
 * e.g. "8 جمادى الآخرة 1447 هـ".
 * Empty when the browser has no Islamic calendar.
 */
export function formatHijriDate(date: Date, timeZone?: string, digits: DateDigits = 'latn'): string {
  const nu = digits === 'latn' ? '-nu-latn' : '';
  const formats = [`ar-SY-u-ca-islamic-umalqura${nu}`, `ar-SY-u-ca-islamic${nu}`];
  for (const locale of formats) {
    try {
      const fmt = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone,
        ...(digits === 'latn' ? { numberingSystem: 'latn' } : {}),
      });
      // An engine without the calendar silently falls back to Gregorian.
      if (!fmt.resolvedOptions().calendar.startsWith('islamic')) continue;
      let formatted = fmt.format(date);
      if (digits === 'latn') {
        formatted = formatted.replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
      }
      return formatted.includes('هـ') ? formatted : `${formatted} هـ`;
    } catch {
      // try the next calendar
    }
  }
  return '';
}

/** The endpoint's `hijri` object as "8 جمادى الآخرة 1447" (no era suffix). */
export function hijriDateLabel(hijri: PrayerHijri | null): string | null {
  if (!hijri?.day || !hijri?.month || !hijri?.year) return null;
  return `${hijri.day} ${hijri.month} ${hijri.year}`;
}
