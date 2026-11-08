import { describe, expect, it } from 'vitest';
import { dayWord, daysPhrase, formatDate, hoursPhrase, minutesPhrase, safeHref, speakerImage } from './format';

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
