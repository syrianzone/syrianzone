import { describe, expect, it } from 'vitest';
import { CHART_GROUPS, chartToday, countGroups, cumulativeTrend, dayNumber, lifelines, LIFELINE_LOOKAHEAD_DAYS, percentOf, sectorBreakdown, speakerBreakdown } from './charts';
import { matchesState } from './filters';
import type { PromiseCardData, PromiseState } from '@/Domain/promises/types';

const card = (id: string, patch: Partial<PromiseCardData> = {}): PromiseCardData => ({
    id, number: Number(id), title: 'تحسين الكهرباء', speaker: { id: 'a', name: 'أحمد', title: null, image: null },
    sector: { id: 'energy', label: 'الكهرباء والطاقة', icon: null }, institution: null,
    isNational: true, governorates: [], tags: [],
    statementDate: '2025-01-01', deadlineDate: null, deadlineWording: null,
    status: 'pending', state: 'pending', daysLeft: null, daysSince: 1,
    counter: { mode: 'since', value: 1 }, keptLate: false, resolvedAt: null, target: null, votingOpen: true, ...patch,
});

const ALL_STATES: PromiseState[] = ['pending', 'in_progress', 'overdue', 'fulfilled', 'partially_fulfilled', 'broken', 'postponed', 'retracted'];

describe('state groups', () => {
    const promises = ALL_STATES.map((state, i) => card(String(i + 1), { state }));

    it('puts every promise in exactly one group, so the groups add up', () => {
        const counts = countGroups(promises);
        expect(counts).toEqual({ fulfilled: 1, partial: 1, open: 2, other: 2, overdue: 1, broken: 1 });
        expect(CHART_GROUPS.reduce((sum, group) => sum + counts[group], 0)).toBe(promises.length);
    });

    it('counts each group exactly as its list filter would show it', () => {
        const counts = countGroups(promises);
        for (const group of CHART_GROUPS) {
            expect(promises.filter((p) => matchesState(p, group, 30)).length).toBe(counts[group]);
        }
    });

    it('gives a zero share of an empty total', () => {
        expect(percentOf(0, 0)).toBe(0);
        expect(percentOf(1, 3)).toBe(33);
    });
});

describe('breakdowns', () => {
    it('ranks sectors by size and skips promises without one', () => {
        const rows = sectorBreakdown([
            card('1', { state: 'broken' }),
            card('2', { state: 'fulfilled' }),
            card('3', { sector: { id: 'health', label: 'الصحة', icon: null } }),
            card('4', { sector: null }),
        ]);
        expect(rows.map((r) => [r.id, r.total])).toEqual([['energy', 2], ['health', 1]]);
        expect(rows[0].counts).toMatchObject({ broken: 1, fulfilled: 1 });
    });

    it('counts a joint promise for each speaker once', () => {
        const b = { id: 'b', name: 'باسل', title: null, image: null };
        const rows = speakerBreakdown([
            card('1', { coSpeakers: [b, b] }),
            card('2', { speaker: b }),
            card('3', { speaker: { id: null, name: null, title: null, image: null } }),
        ]);
        expect(rows.map((r) => [r.id, r.total])).toEqual([['b', 2], ['a', 1]]);
    });
});

describe('today', () => {
    it('is recovered from the server-counted days on a card', () => {
        expect(chartToday([card('1', { statementDate: '2025-12-30', daysSince: 3 })])).toBe('2026-01-02');
        expect(chartToday([])).toBeNull();
    });
});

describe('cumulative trend', () => {
    const promises = [
        card('1', { statementDate: '2024-12-10', state: 'fulfilled', resolvedAt: '2025-02-03' }),
        card('2', { statementDate: '2025-02-01', state: 'broken', resolvedAt: '2025-02-20' }),
        card('3', { statementDate: '2025-02-20' }),
        // A stale verdict date on a promise that is open again is not a verdict.
        card('4', { statementDate: '2025-02-21', state: 'in_progress', resolvedAt: '2025-02-25' }),
    ];

    it('runs unbroken from the first statement to the current month', () => {
        expect(cumulativeTrend(promises, '2025-03-15').map((p) => [p.key, p.made, p.settled])).toEqual([
            ['2024-12', 1, 0], ['2025-01', 1, 0], ['2025-02', 4, 2], ['2025-03', 4, 2],
        ]);
    });

    it('never counts more verdicts than promises, and ends on the totals', () => {
        const points = cumulativeTrend(promises, '2025-03-15');
        expect(points.every((p) => p.settled <= p.made)).toBe(true);
        expect(points[points.length - 1]).toMatchObject({ made: 4, settled: 2, year: 2025, month: 3 });
    });

    it('returns nothing for an empty tracker', () => {
        expect(cumulativeTrend([], '2025-03-15')).toEqual([]);
    });
});

describe('lifelines', () => {
    const day = (iso: string) => dayNumber(iso)!;

    it('orders promises by statement date and keeps verdicts only for settled ones', () => {
        const chart = lifelines([
            card('2', { statementDate: '2025-03-01', deadlineDate: '2025-06-01', state: 'in_progress', resolvedAt: '2025-04-01' }),
            card('1', { statementDate: '2025-01-01', deadlineDate: '2025-02-01', state: 'fulfilled', resolvedAt: '2025-02-10' }),
        ], '2025-07-01');
        expect(chart.rows.map((r) => [r.number, r.group, r.resolved])).toEqual([
            [1, 'fulfilled', day('2025-02-10')], [2, 'open', null],
        ]);
        expect(chart.rows[1].deadline).toBe(day('2025-06-01'));
    });

    it('ends the window a year from today rather than at a distant deadline', () => {
        const chart = lifelines([card('1', { statementDate: '2025-01-01', deadlineDate: '2029-12-06' })], '2025-07-01');
        expect(chart).toMatchObject({ from: day('2025-01-01'), to: day('2025-07-01') + LIFELINE_LOOKAHEAD_DAYS, today: day('2025-07-01') });
    });

    it('still has a window without a today', () => {
        const chart = lifelines([card('1', { statementDate: '2025-01-01', deadlineDate: '2025-03-01' })], null);
        expect(chart).toMatchObject({ from: day('2025-01-01'), to: day('2025-03-01'), today: null });
    });
});
