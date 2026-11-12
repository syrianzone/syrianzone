import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import PromiseShow from './Show';
import type { PromiseDetailData } from '@/Domain/promises/types';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@inertiajs/react')>();
    return {
        ...actual,
        Head: ({ children }: any) => createElement('head', null, children),
        Link: ({ children, href, ...props }: any) => createElement('a', { href, ...props }, children),
        usePage: () => ({ component: 'Promises/Show', url: '/promises/42', props: { auth: {}, seo: {} } }),
        router: { remember: vi.fn(), visit: vi.fn(), post: vi.fn() },
    };
});

describe('PromiseShow component', () => {
    const baseDetail: PromiseDetailData = {
        id: 'p-1',
        number: 42,
        title: 'بناء 1000 وحدة سكنية',
        summary: 'مشروع سكني للعائلات المتضررة',
        quote: 'سننجز ألف وحدة سكنية قبل نهاية عام 2026',
        quoteIsVerbatim: true,
        statementDate: '2025-01-01',
        statementVenue: 'official_statement',
        deadlineDate: '2026-12-31',
        deadlineWording: 'نهاية 2026',
        deadlineReasoning: 'اعتمدنا 31 كانون الأول 2026 كآخر يوم في العام المذكور.',
        speaker: { id: 's-1', name: 'وزير الإسكان', title: 'وزير الإسكان والتعمير', image: null },
        institution: { id: 'i-1', name: 'وزارة الإسكان' },
        sector: { id: 'sec-1', label: 'الإسكان', icon: 'house' },
        isNational: true,
        governorates: [],
        governorateNames: [],
        speakerXHandle: 'housing_min',
        tags: ['إسكان', 'إعمار'],
        status: 'in_progress',
        state: 'in_progress',
        daysLeft: 300,
        daysSince: 100,
        counter: { mode: 'left', value: 300 },
        keptLate: false,
        resolvedAt: null,
        target: null,
        sources: [
            {
                id: 1,
                url: 'https://example.com/source1',
                outlet: 'وكالة سانا',
                type: 'official_statement',
                publishedDate: '2025-01-01',
                language: 'ar',
                archiveUrl: null,
                screenshotUrl: null,
                videoTimestamp: null,
                isPrimary: true,
            },
        ],
        updates: [],
        restates: null,
        restatedBy: null,
        votes: { yes: 10, no: 2 },
        votingOpen: true,
        publishedAt: '2025-01-02',
        updatedAt: '2025-01-02',
    };

    it('renders original deadline note when postponedCount > 0 and originalDeadlineDate is present', () => {
        const promiseWithPostponement: PromiseDetailData = {
            ...baseDetail,
            originalDeadlineDate: '2025-12-31',
            originalDeadlineWording: 'نهاية 2025',
            postponedCount: 1,
        };

        const html = renderToStaticMarkup(createElement(PromiseShow, { promise: promiseWithPostponement }));

        expect(html).toContain('الموعد الأصلي قبل التأجيل');
        expect(html).toContain('31 كانون الأول 2025');
        expect(html).toContain('«نهاية 2025»');
        expect(html).toContain('تأجّل مرة واحدة');
    });

    it('renders plural postponement text for multiple delays', () => {
        const promiseMultipleDelays: PromiseDetailData = {
            ...baseDetail,
            originalDeadlineDate: '2025-06-30',
            originalDeadlineWording: null,
            postponedCount: 3,
        };

        const html = renderToStaticMarkup(createElement(PromiseShow, { promise: promiseMultipleDelays }));

        expect(html).toContain('الموعد الأصلي قبل التأجيل');
        expect(html).toContain('تأجّل 3 مرات');
    });

    it('renders related promises card when relatedPromises array is provided', () => {
        const promiseWithRelated: PromiseDetailData = {
            ...baseDetail,
            relatedPromises: [
                {
                    number: 101,
                    title: 'ترميم البنية التحتية للمدينة',
                    state: 'fulfilled',
                    speakerName: 'محافظ المدينة',
                    statementDate: '2024-05-01',
                    deadlineDate: '2025-01-01',
                },
                {
                    number: 102,
                    title: 'تأهيل شبكة المياه',
                    state: 'in_progress',
                    speakerName: 'مدير مؤسسة المياه',
                    statementDate: '2024-08-10',
                    deadlineDate: null,
                },
            ],
        };

        const html = renderToStaticMarkup(createElement(PromiseShow, { promise: promiseWithRelated }));

        expect(html).toContain('وعود مرتبطة بهذا الملف (2)');
        expect(html).toContain('الوعد رقم 101 — ترميم البنية التحتية للمدينة');
        expect(html).toContain('href="/promises/101"');
        expect(html).toContain('محافظ المدينة');
        expect(html).toContain('الموعد 1 كانون الثاني 2025');

        expect(html).toContain('الوعد رقم 102 — تأهيل شبكة المياه');
        expect(html).toContain('href="/promises/102"');
        expect(html).toContain('مدير مؤسسة المياه');
    });

    it('does not render related promises card when relatedPromises is empty or missing', () => {
        const html = renderToStaticMarkup(createElement(PromiseShow, { promise: baseDetail }));
        expect(html).not.toContain('وعود مرتبطة بهذا الملف');
    });
});
