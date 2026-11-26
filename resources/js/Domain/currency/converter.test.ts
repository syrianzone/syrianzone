import { describe, expect, it } from 'vitest';
import { breakdown, convert, formatArabicNumber, normalizeDigits, parseAmount } from './converter';

describe('currency domain: parseAmount', () => {
    it('parses Western digits with thousands separators and spaces', () => {
        expect(parseAmount('10000')).toBe(10000);
        expect(parseAmount('10,000')).toBe(10000);
        expect(parseAmount('1 000 000')).toBe(1000000);
        expect(parseAmount('  25,500.75  ')).toBe(25500.75);
    });

    it('parses Arabic-Indic and Eastern Arabic-Indic digits and Arabic separators', () => {
        expect(normalizeDigits('١٢٣٤٥٦٧٨٩٠')).toBe('1234567890');
        expect(parseAmount('١٠٬٠٠٠')).toBe(10000);
        expect(parseAmount('١٥٠٠٫٥')).toBe(1500.5);
        expect(parseAmount('٢٥ ٠٠٠')).toBe(25000);
        expect(parseAmount('۱۲۳۴')).toBe(1234);
    });

    it('handles zero and huge safe numbers', () => {
        expect(parseAmount('0')).toBe(0);
        expect(parseAmount('٠')).toBe(0);
        expect(parseAmount('0.00')).toBe(0);
        expect(parseAmount('1,000,000,000,000')).toBe(1000000000000);
    });

    it('rejects empty, negative, malformed, or unsafe numbers', () => {
        expect(parseAmount('')).toBeNull();
        expect(parseAmount('   ')).toBeNull();
        expect(parseAmount('-100')).toBeNull();
        expect(parseAmount('-١٠٠')).toBeNull();
        expect(parseAmount('abc')).toBeNull();
        expect(parseAmount('100abc')).toBeNull();
        expect(parseAmount('12.34.56')).toBeNull();
        expect(parseAmount('99999999999999999')).toBeNull();
    });
});

describe('currency domain: convert', () => {
    it('converts old SYP to new SYP by dividing by 100', () => {
        expect(convert(100, 'old-to-new')).toBe(1);
        expect(convert(10000, 'old-to-new')).toBe(100);
        expect(convert(1250, 'old-to-new')).toBe(12.5);
        expect(convert(33, 'old-to-new')).toBe(0.33);
        expect(convert(1, 'old-to-new')).toBe(0.01);
        expect(convert(1000000, 'old-to-new')).toBe(10000);
    });

    it('converts new SYP to old SYP by multiplying by 100 without float drift', () => {
        expect(convert(1, 'new-to-old')).toBe(100);
        expect(convert(500, 'new-to-old')).toBe(50000);
        expect(convert(1.13, 'new-to-old')).toBe(113);
        expect(convert(12.5, 'new-to-old')).toBe(1250);
    });

    it('returns 0 for zero, negative, or non-finite inputs', () => {
        expect(convert(0, 'old-to-new')).toBe(0);
        expect(convert(-500, 'old-to-new')).toBe(0);
        expect(convert(Number.NaN, 'new-to-old')).toBe(0);
        expect(convert(Number.POSITIVE_INFINITY, 'old-to-new')).toBe(0);
    });
});

describe('currency domain: breakdown (DP min-note change)', () => {
    it('solves non-greedy cases like 30, 40, 505, and 515 optimally', () => {
        const res30 = breakdown(30);
        expect(res30.exact).toBe(true);
        expect(res30.payable).toBe(30);
        expect(res30.remainder).toBe(0);
        expect(res30.totalNotes).toBe(3);
        expect(res30.rows).toEqual([{ denomination: 10, count: 3, subtotal: 30 }]);

        const res40 = breakdown(40);
        expect(res40.exact).toBe(true);
        expect(res40.totalNotes).toBe(4);
        expect(res40.rows).toEqual([{ denomination: 10, count: 4, subtotal: 40 }]);

        // Greedy would pick 500 and leave 5 or 15 unpayable; DP breaks 500 to pay exactly!
        const res505 = breakdown(505);
        expect(res505.exact).toBe(true);
        expect(res505.payable).toBe(505);
        expect(res505.remainder).toBe(0);
        expect(res505.totalNotes).toBe(7); // 200*2 + 50 + 25 + 10*3

        const res515 = breakdown(515);
        expect(res515.exact).toBe(true);
        expect(res515.payable).toBe(515);
        expect(res515.remainder).toBe(0);
        expect(res515.totalNotes).toBe(8); // 200*2 + 50 + 25 + 10*4

        const res1015 = breakdown(1015);
        expect(res1015.exact).toBe(true);
        expect(res1015.payable).toBe(1015);
        expect(res1015.totalNotes).toBe(9); // 500 + (200*2 + 50 + 25 + 10*4)
    });

    it('handles standard exact amounts cleanly', () => {
        const res885 = breakdown(885);
        expect(res885.exact).toBe(true);
        expect(res885.totalNotes).toBe(6);
        expect(res885.rows).toEqual([
            { denomination: 500, count: 1, subtotal: 500 },
            { denomination: 200, count: 1, subtotal: 200 },
            { denomination: 100, count: 1, subtotal: 100 },
            { denomination: 50, count: 1, subtotal: 50 },
            { denomination: 25, count: 1, subtotal: 25 },
            { denomination: 10, count: 1, subtotal: 10 },
        ]);
    });

    it('returns closest payable <= target plus remainder for unpayable amounts and fractions', () => {
        expect(breakdown(5)).toEqual({
            target: 5,
            payable: 0,
            remainder: 5,
            totalNotes: 0,
            exact: false,
            rows: [],
        });

        const res15 = breakdown(15);
        expect(res15.exact).toBe(false);
        expect(res15.payable).toBe(10);
        expect(res15.remainder).toBe(5);
        expect(res15.rows).toEqual([{ denomination: 10, count: 1, subtotal: 10 }]);

        const res19 = breakdown(19);
        expect(res19.exact).toBe(false);
        expect(res19.payable).toBe(10);
        expect(res19.remainder).toBe(9);

        const res37_5 = breakdown(37.5);
        expect(res37_5.exact).toBe(false);
        expect(res37_5.payable).toBe(35);
        expect(res37_5.remainder).toBe(2.5);
        expect(res37_5.rows).toEqual([
            { denomination: 25, count: 1, subtotal: 25 },
            { denomination: 10, count: 1, subtotal: 10 },
        ]);
    });

    it('handles zero, negative, and huge amounts without OOM', () => {
        expect(breakdown(0)).toEqual({
            target: 0,
            payable: 0,
            remainder: 0,
            totalNotes: 0,
            exact: true,
            rows: [],
        });

        expect(breakdown(-25)).toEqual({
            target: 0,
            payable: 0,
            remainder: 0,
            totalNotes: 0,
            exact: false,
            rows: [],
        });

        const huge = breakdown(1_000_000_030);
        expect(huge.exact).toBe(true);
        expect(huge.payable).toBe(1_000_000_030);
        expect(huge.remainder).toBe(0);
        expect(huge.rows).toEqual([
            { denomination: 500, count: 2_000_000, subtotal: 1_000_000_000 },
            { denomination: 10, count: 3, subtotal: 30 },
        ]);
    });

    it('formats numbers with Arabic locale grouping', () => {
        expect(formatArabicNumber(10000)).toBe('١٠٬٠٠٠');
        expect(formatArabicNumber(12.5)).toBe('١٢٫٥');
    });
});
