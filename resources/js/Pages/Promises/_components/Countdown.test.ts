import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Countdown from './Countdown';
import type { CounterMode, PromiseState } from '../_lib/types';

describe('Countdown caption rendering', () => {
    it('changes only the long caption while retaining the exact numeral and spoken days', () => {
        const html = renderToStaticMarkup(createElement(Countdown, {
            state: 'overdue', counter: { mode: 'overdue', value: 425 }, deadlineDate: '2025-01-01',
        }));
        expect(html).toContain('>+425</span>');
        expect(html).toContain('>أكثر من سنة وشهرين من التأخير</span>');
        expect(html).toContain('<span class="sr-only">تجاوز الموعد بـ425 يوماً</span>');
    });

    it.each<[PromiseState, CounterMode, number | null, string]>([
        ['overdue', 'overdue', 30, 'يوماً من التأخير'],
        ['fulfilled', 'ontime', null, 'في يوم الموعد'],
        ['broken', 'closed', null, 'لم يتحقق'],
    ])('preserves the existing %s / %s caption', (state, mode, value, caption) => {
        const html = renderToStaticMarkup(createElement(Countdown, {
            state, counter: { mode, value }, deadlineDate: '2025-01-01', statementDate: '2025-01-01',
        }));
        expect(html).toContain(`>${caption}</span>`);
    });
});
