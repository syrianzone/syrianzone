import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PromiseCard from './PromiseCard';
import type { PromiseCardData } from '../_lib/types';

vi.mock('@inertiajs/react', () => ({
    Link: ({ children, href, ...props }: any) => createElement('a', { href, ...props }, children),
    usePage: () => ({ component: 'Promises/Index', url: '/promises', props: {} }),
    router: { remember: vi.fn() },
}));

describe('PromiseCard component', () => {
    const basePromise: PromiseCardData = {
        id: 'p-1',
        number: 42,
        title: 'تأمين الكهرباء على مدار 24 ساعة',
        speaker: { id: 's-1', name: 'وزير الطاقة', title: 'وزير الكهرباء', image: null },
        institution: { id: 'i-1', name: 'وزارة الكهرباء' },
        sector: { id: 'sec-1', label: 'الطاقة', icon: 'zap' },
        isNational: true,
        governorates: [],
        tags: ['كهرباء', 'طاقة'],
        statementDate: '2025-01-01',
        deadlineDate: '2026-12-31',
        deadlineWording: 'نهاية 2026',
        status: 'in_progress',
        state: 'in_progress',
        daysLeft: 200,
        daysSince: 100,
        counter: { mode: 'left', value: 200 },
        keptLate: false,
        resolvedAt: null,
        target: null,
    };

    it('displays original struck-through deadline when postponedCount > 0 and originalDeadlineDate is set', () => {
        const promiseWithPostponed: PromiseCardData = {
            ...basePromise,
            originalDeadlineDate: '2025-06-30',
            originalDeadlineWording: 'منتصف 2025',
            postponedCount: 1,
        };

        const html = renderToStaticMarkup(createElement(PromiseCard, { promise: promiseWithPostponed }));

        expect(html).toContain('الموعد الأصلي:');
        expect(html).toContain('line-through');
        expect(html).toContain('30 حزيران 2025');
    });

    it('does not display original deadline when postponedCount is 0 or undefined', () => {
        const normalPromise: PromiseCardData = {
            ...basePromise,
            postponedCount: 0,
            originalDeadlineDate: null,
        };

        const html = renderToStaticMarkup(createElement(PromiseCard, { promise: normalPromise }));

        expect(html).not.toContain('الموعد الأصلي:');
    });
});
