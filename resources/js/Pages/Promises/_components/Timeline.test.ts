import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Timeline from './Timeline';
import type { PromiseUpdateData } from '../_lib/types';

describe('Timeline component', () => {
    const baseUpdates: PromiseUpdateData[] = [
        {
            id: 1,
            type: 'status_change',
            happenedOn: '2025-06-01',
            statusFrom: 'pending',
            statusTo: 'in_progress',
            body: 'بدأت الأعمال الميدانية',
            value: null,
            sourceUrl: 'https://example.com/start',
            archiveUrl: null,
        },
        {
            id: 2,
            type: 'deadline_change',
            happenedOn: '2025-09-15',
            statusFrom: null,
            statusTo: null,
            body: 'أعلن الوزير تمديد المهلة حتى نهاية العام نظراً للظروف الجوية',
            value: null,
            sourceUrl: 'https://example.com/reschedule',
            archiveUrl: 'https://web.archive.org/example',
        },
    ];

    it('renders timeline with deadline_change update type and label', () => {
        const html = renderToStaticMarkup(createElement(Timeline, {
            statementDate: '2025-01-01',
            statementVenue: 'official_statement',
            updates: baseUpdates,
        }));

        // Statement item
        expect(html).toContain('أُطلق الوعد');

        // Status change
        expect(html).toContain('تغيّر الحالة');
        expect(html).toContain('بدأت الأعمال الميدانية');

        // Deadline change
        expect(html).toContain('تأجيل الموعد');
        expect(html).toContain('أعلن الوزير تمديد المهلة حتى نهاية العام');
        expect(html).toContain('href="https://example.com/reschedule"');
        expect(html).toContain('href="https://web.archive.org/example"');
        // Lucide CalendarClock svg is rendered
        expect(html).toContain('lucide-calendar-clock');
    });

    it('handles only deadline_change updates correctly', () => {
        const deadlineOnly: PromiseUpdateData[] = [
            {
                id: 10,
                type: 'deadline_change',
                happenedOn: '2026-03-01',
                statusFrom: null,
                statusTo: null,
                body: 'تم التأجيل إلى 2027',
                value: null,
                sourceUrl: null,
                archiveUrl: null,
            },
        ];

        const html = renderToStaticMarkup(createElement(Timeline, {
            statementDate: '2025-01-01',
            statementVenue: 'press_conference',
            updates: deadlineOnly,
        }));

        expect(html).toContain('تأجيل الموعد');
        expect(html).toContain('تم التأجيل إلى 2027');
    });
});
