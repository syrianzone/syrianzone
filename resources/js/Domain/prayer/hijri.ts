import type { PrayerHijri } from './times';

/**
 * Hijri dates. The timings endpoint already returns the Umm al-Qura date it
 * computed, so `hijriDateLabel` is the primary path; `formatHijriDate` is the
 * client-side fallback for the surfaces that print today's date before (or
 * instead of) that response.
 */

/** e.g. "٨ جمادى الآخرة ١٤٤٧ هـ". Empty when the browser has no Islamic calendar. */
export function formatHijriDate(date: Date): string {
  const formats = ['ar-SY-u-ca-islamic-umalqura', 'ar-SY-u-ca-islamic'];
  for (const locale of formats) {
    try {
      const formatted = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(date);
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
