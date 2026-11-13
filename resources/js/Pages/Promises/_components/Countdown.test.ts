import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Countdown from './Countdown';
import type { CounterMode, PromiseState } from '@/Domain/promises/types';

/**
 * The component's content as a reader (or a screen reader) receives it: the
 * markup is stripped, so the assertions are about the words on screen and the
 * sentence exposed to assistive tech, not about element or class names.
 */
function textOf(markup: string): string {
    return markup
        .replace(/<[^>]*>/g, '')
        .replace(/&(#\d+|quot|amp|lt|gt|nbsp|#x[0-9a-f]+);/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

describe('Countdown caption rendering', () => {
    it('changes only the long caption while retaining the exact numeral and spoken days', () => {
        const text = textOf(renderToStaticMarkup(createElement(Countdown, {
            state: 'overdue', counter: { mode: 'overdue', value: 425 }, deadlineDate: '2025-01-01',
        })));

        // The number the page is about, still signed and unabbreviated.
        expect(text).toContain('+425');
        // The calendar wording a long delay deserves.
        expect(text).toContain('أكثر من سنة وشهرين من التأخير');
        // The full sentence a screen reader hears, unchanged by the caption work.
        expect(text).toContain('تجاوز الموعد بـ425 يوماً');
    });

    it.each<[PromiseState, CounterMode, number | null, string]>([
        ['overdue', 'overdue', 30, 'يوماً من التأخير'],
        ['fulfilled', 'ontime', null, 'في يوم الموعد'],
        ['broken', 'closed', null, 'لم يتحقق'],
    ])('preserves the existing %s / %s caption', (state, mode, value, caption) => {
        const text = textOf(renderToStaticMarkup(createElement(Countdown, {
            state, counter: { mode, value }, deadlineDate: '2025-01-01', statementDate: '2025-01-01',
        })));

        expect(text).toContain(caption);
    });
});
