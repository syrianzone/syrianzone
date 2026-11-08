import { SYRIAN_MONTHS_AR } from '@/Lib/syrian-date';
import { formatEntityImage } from '@/Lib/entityImage';

/**
 * Formatting for the promises tracker. Numbers use Western digits (0–9), as
 * agreed for this module; month names come from the shared Syrian calendar.
 */

/** "31 آب 2026" from an ISO date (YYYY-MM-DD), parsed without timezone drift. */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} ${SYRIAN_MONTHS_AR[m - 1]} ${y}`;
}

interface NounForms {
    /** After 1, and after whole hundreds/100+1/100+2 (مئة يوم، 101 يوم). */
    one: string;
    /** Exactly 2, written without the numeral (يومان). */
    two: string;
    /** 3–10, and any number ending in 03–10 (أيام). */
    few: string;
    /** 11–99, and any number ending in 11–99 (يوماً). */
    many: string;
}

/**
 * The counted noun after a number, following Arabic number agreement: the
 * form depends on the last two digits, except that exactly 2 takes the dual.
 */
function countedNoun(n: number, forms: NounForms): string {
    const abs = Math.abs(n);
    if (abs === 2) return forms.two;
    const lastTwo = abs % 100;
    if (lastTwo >= 3 && lastTwo <= 10) return forms.few;
    if (lastTwo >= 11) return forms.many;
    return forms.one;
}

const DAY: NounForms = { one: 'يوم', two: 'يومان', few: 'أيام', many: 'يوماً' };
const HOUR: NounForms = { one: 'ساعة', two: 'ساعتان', few: 'ساعات', many: 'ساعة' };
const MINUTE: NounForms = { one: 'دقيقة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' };

/** The noun for a day count printed under a big numeral: 47 → يوماً, 5 → أيام. */
export function dayWord(n: number): string {
    return countedNoun(n, DAY);
}

/**
 * A full phrase for running text and screen readers. One and two are said
 * without the numeral (يوم واحد، يومان), as Arabic does.
 */
function phrase(n: number, forms: NounForms, oneWord: string): string {
    const abs = Math.abs(n);
    if (abs === 1) return oneWord;
    if (abs === 2) return forms.two;
    return `${abs} ${countedNoun(abs, forms)}`;
}

export const daysPhrase = (n: number) => phrase(n, DAY, 'يوم واحد');
export const hoursPhrase = (n: number) => phrase(n, HOUR, 'ساعة واحدة');
export const minutesPhrase = (n: number) => phrase(n, MINUTE, 'دقيقة واحدة');

/** "1,250" — grouped Western digits for targets and progress values. */
export function formatNumber(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

/**
 * The image URL for a speaker. Officials-directory images may be stored as a
 * bare filename on R2, which the directory's own helper knows how to expand;
 * tier-list and uploaded images are already absolute or root-relative.
 */
export function speakerImage(url: string | null | undefined): string | null {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
    return formatEntityImage(url);
}

/** Fallback text for an avatar with no photo: the first letter of the name. */
export function nameInitial(name: string | null | undefined): string {
    return (name ?? '').trim().charAt(0) || '؟';
}

/**
 * Only http(s) and site-relative links are rendered as hrefs. The server
 * validates the same rule; this is defence in depth for older rows.
 */
export function safeHref(url: string | null | undefined): string | null {
    if (!url) return null;
    return /^(https?:\/\/|\/(?!\/))/i.test(url.trim()) ? url : null;
}
