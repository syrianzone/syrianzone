import { describe, expect, it } from 'vitest';
import { initialForm, toPayload } from './Edit';
import type { AdminPromiseDetail } from './_lib/types';

describe('Admin Promise Editor helpers', () => {
    const baseAdminDetail: AdminPromiseDetail = {
        id: 'promise-uuid-1',
        number: 55,
        title: 'افتتاح محطة التوليد الجديدة',
        summary: 'المحطة تغذي 500 ألف منزل',
        quote: 'سنفتتح المحطة في تموز القادم',
        quoteIsVerbatim: true,
        speaker: null,
        speakerTitle: 'مدير محطة التوليد',
        institutionId: 'inst-1',
        sectorId: 'sec-1',
        isNational: false,
        governorates: ['damascus', 'rural_damascus'],
        tags: ['كهرباء', 'طاقة'],
        statementDate: '2025-01-15',
        statementVenue: 'press_conference',
        deadlineWording: 'تموز القادم',
        deadlineDate: '2025-07-31',
        deadlineReasoning: 'نهاية شهر تموز',
        targetValue: 500,
        targetUnit: 'ميغاواط',
        baselineValue: 100,
        baselineNote: 'القدرة الحالية',
        restatesPromiseId: null,
        restates: null,
        status: 'in_progress',
        state: 'in_progress',
        resolvedAt: null,
        reviewStatus: 'published',
        publishedAt: '2025-01-16',
        origin: 'editor',
        submitterName: null,
        submitterNote: null,
        rejectionReason: null,
        sources: [],
        updates: [],
        version: 1,
        relatedPromiseIds: ['promise-uuid-2', 'promise-uuid-3'],
    };

    it('initialForm properly sets relatedPromiseIds from promise or empty array', () => {
        const formWithRelated = initialForm(baseAdminDetail);
        expect(formWithRelated.relatedPromiseIds).toEqual(['promise-uuid-2', 'promise-uuid-3']);

        const formWithoutRelated = initialForm({
            ...baseAdminDetail,
            relatedPromiseIds: undefined,
        });
        expect(formWithoutRelated.relatedPromiseIds).toEqual([]);

        const formNull = initialForm(null);
        expect(formNull.relatedPromiseIds).toEqual([]);
    });

    it('toPayload maps form to payload including related_promise_ids', () => {
        const form = initialForm(baseAdminDetail);
        form.relatedPromiseIds = ['promise-uuid-a', 'promise-uuid-b'];

        const payload = toPayload(form);
        expect(payload.related_promise_ids).toEqual(['promise-uuid-a', 'promise-uuid-b']);
        expect(payload.title).toBe('افتتاح محطة التوليد الجديدة');
    });
});
