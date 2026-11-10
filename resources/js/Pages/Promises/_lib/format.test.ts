import { describe, expect, it } from 'vitest';
import { calendarCounterCaption, dayWord, daysPhrase, formatDate, hoursPhrase, minutesPhrase, safeHref, speakerImage } from './format';
import type { CounterMode } from './types';

describe('dayWord (Arabic counted noun after a numeral)', () => {
    it.each([
        [1, 'يوم'],
        [2, 'يومان'],
        [3, 'أيام'],
        [10, 'أيام'],
        [11, 'يوماً'],
        [47, 'يوماً'],
        [99, 'يوماً'],
        [100, 'يوم'],
        [101, 'يوم'],
        [102, 'يوم'],
        [103, 'أيام'],
        [110, 'أيام'],
        [111, 'يوماً'],
        [404, 'أيام'],
        [700, 'يوم'],
        [1124, 'يوماً'],
        [-12, 'يوماً'],
    ])('%i → %s', (n, word) => {
        expect(dayWord(n)).toBe(word);
    });
});

describe('phrases for running text and screen readers', () => {
    it('says one and two without the numeral', () => {
        expect(daysPhrase(1)).toBe('يوم واحد');
        expect(daysPhrase(2)).toBe('يومان');
        expect(hoursPhrase(1)).toBe('ساعة واحدة');
        expect(hoursPhrase(2)).toBe('ساعتان');
        expect(minutesPhrase(2)).toBe('دقيقتان');
    });

    it('agrees with the number otherwise', () => {
        expect(daysPhrase(5)).toBe('5 أيام');
        expect(daysPhrase(30)).toBe('30 يوماً');
        expect(hoursPhrase(5)).toBe('5 ساعات');
        expect(hoursPhrase(13)).toBe('13 ساعة');
        expect(minutesPhrase(7)).toBe('7 دقائق');
        expect(minutesPhrase(45)).toBe('45 دقيقة');
    });
});

describe('formatDate', () => {
    it('uses Syrian month names and Western digits without timezone drift', () => {
        expect(formatDate('2026-08-31')).toBe('31 آب 2026');
        expect(formatDate('2025-01-01')).toBe('1 كانون الثاني 2025');
        expect(formatDate('2025-12-31T23:30:00+03:00')).toBe('31 كانون الأول 2025');
    });

    it('is empty for missing dates', () => {
        expect(formatDate(null)).toBe('');
        expect(formatDate(undefined)).toBe('');
    });
});

describe('calendar counter captions', () => {
    it.each([
        ['2025-01-31', 27, null],
        ['2025-01-31', 28, 'شهر من التأخير'],
        ['2024-01-31', 28, null],
        ['2024-01-31', 29, 'شهر من التأخير'],
        ['2025-01-01', 30, null],
        ['2025-01-01', 31, 'شهر من التأخير'],
        ['2025-04-01', 30, 'شهر من التأخير'],
        ['2025-01-31', 58, 'أكثر من شهر من التأخير'],
        ['2025-01-31', 59, 'شهران من التأخير'],
        ['2024-02-29', 365, 'سنة من التأخير'],
        ['2024-02-29', 366, 'أكثر من سنة من التأخير'],
        ['2023-03-01', 365, 'أكثر من 11 شهراً من التأخير'],
        ['2025-01-01', 304, '10 أشهر من التأخير'],
        ['2025-01-01', 305, 'أكثر من 10 أشهر من التأخير'],
        ['2025-01-01', 365, 'سنة من التأخير'],
        ['2025-01-01', 425, 'أكثر من سنة وشهرين من التأخير'],
        ['2025-01-01', 730, 'سنتان من التأخير'],
        ['2025-01-01', 789, 'سنتان وشهران من التأخير'],
        ['2025-01-01', 790, 'أكثر من سنتين وشهرين من التأخير'],
        ['2025-01-01', 1095, '3 سنوات من التأخير'],
    ])('uses calendar anniversaries from %s over %i days', (deadlineDate, value, expected) => {
        expect(calendarCounterCaption({ mode: 'overdue', value }, { deadlineDate })).toBe(expected);
    });

    it.each<[CounterMode, number, string]>([
        ['left', 59, 'بقي شهران على الموعد'],
        ['left', 60, 'بقي أكثر من شهرين على الموعد'],
        ['early', 59, 'قبل الموعد بشهرين'],
        ['early', 60, 'قبل الموعد بأكثر من شهرين'],
        ['late', 61, 'شهران بعد الموعد'],
        ['late', 62, 'أكثر من شهرين بعد الموعد'],
        ['since', 61, 'شهران منذ إطلاق الوعد'],
        ['since', 62, 'أكثر من شهرين منذ إطلاق الوعد'],
        ['took', 61, 'بعد شهرين من إطلاقه'],
        ['took', 62, 'بعد أكثر من شهرين من إطلاقه'],
    ])('keeps the context and Arabic case for %s (%i days)', (mode, value, expected) => {
        expect(calendarCounterCaption({ mode, value }, { deadlineDate: '2025-03-01', statementDate: '2025-03-01' })).toBe(expected);
    });

    it('uses the statement for counters without a deadline', () => {
        expect(calendarCounterCaption({ mode: 'since', value: 90 }, { statementDate: '2025-01-01', deadlineDate: null }))
            .toBe('3 أشهر منذ إطلاق الوعد');
    });

    it.each<CounterMode>(['today', 'ontime', 'closed'])('preserves the %s caption', (mode) => {
        expect(calendarCounterCaption({ mode, value: 365 }, { deadlineDate: '2025-01-01' })).toBeNull();
    });

    it('falls back for missing or invalid dates and non-duration values', () => {
        for (const deadlineDate of [null, undefined, '', 'invalid', '2025-02-29', '2025-13-01']) {
            expect(calendarCounterCaption({ mode: 'overdue', value: 365 }, { deadlineDate })).toBeNull();
        }
        for (const value of [null, 0, -1, 1.5, Infinity]) {
            expect(calendarCounterCaption({ mode: 'overdue', value }, { deadlineDate: '2025-01-01' })).toBeNull();
        }
    });
});

describe('safeHref', () => {
    it('allows web and site-relative links', () => {
        expect(safeHref('https://sana.sy/?p=1')).toBe('https://sana.sy/?p=1');
        expect(safeHref('http://example.com')).toBe('http://example.com');
        expect(safeHref('/storage/images/promises/sources/a.webp')).toBe('/storage/images/promises/sources/a.webp');
    });

    it('drops script, data and protocol-relative links', () => {
        expect(safeHref('javascript:alert(1)')).toBeNull();
        expect(safeHref(' JavaScript:alert(1)')).toBeNull();
        expect(safeHref('data:text/html,<script>')).toBeNull();
        expect(safeHref('//evil.example')).toBeNull();
        expect(safeHref(null)).toBeNull();
    });
});

describe('speakerImage', () => {
    it('keeps absolute and root-relative URLs', () => {
        expect(speakerImage('https://cdn.example/a.webp')).toBe('https://cdn.example/a.webp');
        expect(speakerImage('/tierlist-assets/images/a.webp')).toBe('/tierlist-assets/images/a.webp');
    });

    it('expands officials-directory filenames to their R2 location', () => {
        expect(speakerImage('images/public_figures/pf-a.webp')).toMatch(/^https:\/\/.+\/syofficial\/entities\/pf-a\.webp$/);
    });

    it('is null without an image', () => {
        expect(speakerImage(null)).toBeNull();
        expect(speakerImage('')).toBeNull();
    });
});
