import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PromiseCard from './PromiseCard';
import type { PromiseCardData } from '@/Domain/promises/types';

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
        votingOpen: true,
    };

    it('shows the original deadline next to the current one once a promise has been postponed', () => {
        const promiseWithPostponed: PromiseCardData = {
            ...basePromise,
            originalDeadlineDate: '2025-06-30',
            originalDeadlineWording: 'منتصف 2025',
            postponedCount: 1,
        };

        const html = renderToStaticMarkup(createElement(PromiseCard, { promise: promiseWithPostponed }));

        // The reader sees both dates, the old one labelled as the original.
        expect(html).toContain('الموعد 31 كانون الأول 2026');
        expect(html).toContain('الموعد الأصلي:');
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

    it('asks the question, and shows no result, before the visitor answers', () => {
        const html = renderToStaticMarkup(createElement(PromiseCard, { promise: { ...basePromise, votes: { yes: 6, no: 2 } } }));
        expect(html).toContain('هل سيتحقق هذا الوعد؟');
        expect(html).toContain('aria-pressed="false"');
        expect(html).not.toContain('75%');
    });

    it('shows the final split, and no buttons, once the promise is settled', () => {
        const settled: PromiseCardData = { ...basePromise, status: 'fulfilled', state: 'fulfilled', votingOpen: false, votes: { yes: 6, no: 2 } };
        const html = renderToStaticMarkup(createElement(PromiseCard, { promise: settled }));
        expect(html).toContain('75%');
        expect(html).toContain('8 أصوات');
        expect(html).not.toContain('aria-pressed');
    });

    it('leaves the vote out of a settled promise with too few votes for a percentage', () => {
        const settled: PromiseCardData = { ...basePromise, status: 'fulfilled', state: 'fulfilled', votingOpen: false, votes: { yes: 3, no: 1 } };
        const html = renderToStaticMarkup(createElement(PromiseCard, { promise: settled }));
        expect(html).not.toContain('75%');
        expect(html).not.toContain('أصوات');
    });
});
