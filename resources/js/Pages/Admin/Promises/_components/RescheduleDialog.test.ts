import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RescheduleDialog from './RescheduleDialog';
import type { AdminPromiseDetail } from '../_lib/types';

vi.mock('@inertiajs/react', () => ({
    router: {
        post: vi.fn(),
    },
}));

vi.mock('@/Components/ui/dialog', () => ({
    Dialog: ({ children, open }: any) => (open ? createElement('div', { 'data-testid': 'dialog' }, children) : null),
    DialogContent: ({ children, ...props }: any) => createElement('div', props, children),
    DialogHeader: ({ children, ...props }: any) => createElement('div', props, children),
    DialogTitle: ({ children, ...props }: any) => createElement('h2', props, children),
    DialogDescription: ({ children, ...props }: any) => createElement('p', props, children),
    DialogFooter: ({ children, ...props }: any) => createElement('div', props, children),
}));

describe('RescheduleDialog component', () => {
    const mockPromise: AdminPromiseDetail = {
        id: 'promise-test-id-123',
        number: 77,
        title: 'تنفيذ المرحلة الثانية',
        summary: null,
        quote: 'سننهي المرحلة خلال أشهر',
        quoteIsVerbatim: true,
        speaker: null,
        speakerTitle: null,
        institutionId: null,
        sectorId: null,
        isNational: true,
        governorates: [],
        tags: [],
        statementDate: '2025-01-01',
        statementVenue: 'official_statement',
        deadlineWording: 'منتصف العام',
        deadlineDate: '2025-06-30',
        deadlineReasoning: null,
        targetValue: null,
        targetUnit: null,
        baselineValue: null,
        baselineNote: null,
        restatesPromiseId: null,
        restates: null,
        status: 'in_progress',
        state: 'in_progress',
        resolvedAt: null,
        reviewStatus: 'published',
        publishedAt: '2025-01-02',
        origin: 'editor',
        submitterName: null,
        submitterNote: null,
        rejectionReason: null,
        sources: [],
        updates: [],
        version: 1,
    };

    it('renders the reschedule dialog with all required fields', () => {
        const html = renderToStaticMarkup(createElement(RescheduleDialog, {
            promise: mockPromise,
            today: '2025-05-10',
            open: true,
            onOpenChange: vi.fn(),
        }));

        expect(html).toContain('تأجيل/تعديل الموعد (مع حفظ الموعد الأصلي)');
        expect(html).toContain('الموعد الجديد (مطلوب)');
        expect(html).toContain('العبارة الجديدة (اختياري)');
        expect(html).toContain('طريقة التحويل / التفسير (اختياري)');
        expect(html).toContain('تاريخ الإعلان (مطلوب)');
        expect(html).toContain('رابط المصدر (مطلوب)');
        expect(html).toContain('نسخة مؤرشفة (اختياري)');
        expect(html).toContain('شرح / ملاحظة للقرّاء (اختياري)');
        expect(html).toContain('حفظ وتأجيل الموعد');
    });
});
