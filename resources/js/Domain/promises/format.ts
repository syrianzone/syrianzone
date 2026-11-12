import { SYRIAN_MONTHS_AR } from '@/Lib/syrian-date';
import { formatEntityImage } from '@/Lib/entityImage';
import type { PromiseCardData, PromiseCounter } from './types';

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

const MONTH: NounForms = { one: 'شهر', two: 'شهران', few: 'أشهر', many: 'شهراً' };
const YEAR: NounForms = { one: 'سنة', two: 'سنتان', few: 'سنوات', many: 'سنة' };

/** Add calendar months, clamping the original day to the target month's end. */
function addCalendarMonths(start: Date, months: number): Date {
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months + 1, 0));
    return new Date(Date.UTC(lastDay.getUTCFullYear(), lastDay.getUTCMonth(), Math.min(start.getUTCDate(), lastDay.getUTCDate())));
}

/** Use server-counted days so SSR and frozen verdict dates stay consistent. */
export function calendarCounterCaption(
    { mode, value }: PromiseCounter,
    { deadlineDate, statementDate }: Partial<Pick<PromiseCardData, 'deadlineDate' | 'statementDate'>>,
): string | null {
    if (mode === 'today' || mode === 'ontime' || mode === 'closed'
        || value === null || !Number.isInteger(value) || value <= 0) return null;

    const iso = mode === 'since' || mode === 'took' ? statementDate : deadlineDate;
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    const [year, month, day] = iso.split('-').map(Number);
    const anchor = new Date(Date.UTC(year, month - 1, day));
    if (anchor.getUTCFullYear() !== year || anchor.getUTCMonth() !== month - 1 || anchor.getUTCDate() !== day) return null;

    const backwards = mode === 'left' || mode === 'early';
    const other = new Date(anchor);
    other.setUTCDate(other.getUTCDate() + (backwards ? -value : value));
    const start = backwards ? other : anchor;
    const end = backwards ? anchor : other;
    let months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
    if (addCalendarMonths(start, months) > end) months -= 1;
    if (months < 1) return null;

    const remainder = addCalendarMonths(start, months) < end;
    const oblique = remainder || mode === 'early' || mode === 'took';
    const unit = (n: number, forms: NounForms, dual: string) => {
        if (n === 1) return forms.one;
        if (n === 2) return oblique ? dual : forms.two;
        return `${n} ${countedNoun(n, forms)}`;
    };
    const parts: string[] = [];
    const years = Math.floor(months / 12);
    if (years) parts.push(unit(years, YEAR, 'سنتين'));
    if (months % 12) parts.push(unit(months % 12, MONTH, 'شهرين'));
    const duration = `${remainder ? 'أكثر من ' : ''}${parts.join(' و')}`;

    switch (mode) {
        case 'left': return `بقي ${duration} على الموعد`;
        case 'overdue': return `${duration} من التأخير`;
        case 'since': return `${duration} منذ إطلاق الوعد`;
        case 'early': return `قبل الموعد ب${duration}`;
        case 'late': return `${duration} بعد الموعد`;
        case 'took': return `بعد ${duration} من إطلاقه`;
    }
}

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
