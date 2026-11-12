import type { PromiseStateFilter } from './filters';
import { isOpenState } from './status';
import type { PromiseCardData, PromiseState } from './types';

/**
 * Aggregations behind the charts view on /promises. They run over the cards
 * the list is showing, so the charts need no extra payload and always agree
 * with the filters and the counts beside them.
 */

/**
 * The scoreboard's six groups, ordered from kept to not kept so a stacked bar
 * reads as a spectrum. Each key is also a state filter value.
 */
export const CHART_GROUPS = ['fulfilled', 'partial', 'open', 'other', 'overdue', 'broken'] as const satisfies readonly PromiseStateFilter[];

export type ChartGroup = (typeof CHART_GROUPS)[number];
export type GroupCounts = Record<ChartGroup, number>;

export const CHART_GROUP_LABEL: Record<ChartGroup, string> = {
    fulfilled: 'تحقق',
    partial: 'تحقق جزئياً',
    open: 'لم يُحسم بعد',
    other: 'أُجّل أو سُحب',
    overdue: 'متأخر',
    broken: 'لم يتحقق',
};

export function chartGroup(state: PromiseState): ChartGroup {
    switch (state) {
        case 'fulfilled': return 'fulfilled';
        case 'partially_fulfilled': return 'partial';
        case 'broken': return 'broken';
        case 'overdue': return 'overdue';
        case 'postponed':
        case 'retracted': return 'other';
        default: return 'open';
    }
}

const emptyCounts = (): GroupCounts => ({ fulfilled: 0, partial: 0, open: 0, other: 0, overdue: 0, broken: 0 });

export function countGroups(promises: readonly PromiseCardData[]): GroupCounts {
    const counts = emptyCounts();
    for (const p of promises) counts[chartGroup(p.state)] += 1;
    return counts;
}

/** Whole-number share of a total; 0 when there is nothing to divide. */
export function percentOf(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
}

export interface BreakdownRow {
    id: string;
    label: string;
    /** Portrait, for speaker rows. */
    image?: string | null;
    total: number;
    counts: GroupCounts;
}

function breakdown(promises: readonly PromiseCardData[], keys: (p: PromiseCardData) => Array<{ id: string | null; label: string | null; image?: string | null }>): BreakdownRow[] {
    const rows = new Map<string, BreakdownRow>();
    for (const p of promises) {
        for (const { id, label, image } of keys(p)) {
            if (!id || !label) continue;
            const row = rows.get(id) ?? { id, label, image, total: 0, counts: emptyCounts() };
            row.total += 1;
            row.counts[chartGroup(p.state)] += 1;
            rows.set(id, row);
        }
    }
    return [...rows.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'ar'));
}

/** Promises per sector, largest first. Promises without a sector are left out. */
export function sectorBreakdown(promises: readonly PromiseCardData[]): BreakdownRow[] {
    return breakdown(promises, (p) => [{ id: p.sector?.id ?? null, label: p.sector?.label ?? null }]);
}

/**
 * Promises per official, largest first. A joint promise counts for each of its
 * speakers, matching what the speaker filter lists.
 */
export function speakerBreakdown(promises: readonly PromiseCardData[]): BreakdownRow[] {
    return breakdown(promises, (p) => {
        const people = [p.speaker, ...(p.coSpeakers ?? [])].map((s) => ({ id: s.id, label: s.name, image: s.image }));
        return people.filter((s, i) => people.findIndex((other) => other.id === s.id) === i);
    });
}

const DAY_MS = 86_400_000;

/** Whole days since the epoch for an ISO date, or null when it is not one. */
export function dayNumber(iso: string | null | undefined): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    if (!match) return null;
    return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / DAY_MS;
}

export function isoDay(day: number): string {
    return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Today in Syrian time, recovered from the server-counted days on a card
 * (statement date + days since), so charts and countdowns share one "today"
 * without reading the visitor's clock.
 */
export function chartToday(promises: readonly PromiseCardData[]): string | null {
    for (const p of promises) {
        const made = dayNumber(p.statementDate);
        if (made !== null && Number.isInteger(p.daysSince)) return isoDay(made + p.daysSince);
    }
    return null;
}

export interface TrendPoint {
    /** YYYY-MM */
    key: string;
    year: number;
    /** 1–12 */
    month: number;
    /** Promises made up to the end of this month. */
    made: number;
    /** Of those, how many had a verdict by the end of this month. */
    settled: number;
}

/**
 * Running totals by month, from the first statement to the current month:
 * promises made, and promises that reached a verdict. The gap between the two
 * is what was still awaiting one.
 */
export function cumulativeTrend(promises: readonly PromiseCardData[], today: string | null): TrendPoint[] {
    const made = new Map<string, number>();
    const settled = new Map<string, number>();
    const bump = (map: Map<string, number>, iso: string | null) => {
        const key = iso?.slice(0, 7);
        if (key && /^\d{4}-\d{2}$/.test(key)) map.set(key, (map.get(key) ?? 0) + 1);
    };
    for (const p of promises) {
        bump(made, p.statementDate);
        if (!isOpenState(p.state)) bump(settled, p.resolvedAt);
    }
    const keys = [...made.keys(), ...settled.keys(), ...(today ? [today.slice(0, 7)] : [])].sort();
    if (made.size === 0) return [];

    const [firstYear, firstMonth] = keys[0].split('-').map(Number);
    const [lastYear, lastMonth] = keys[keys.length - 1].split('-').map(Number);
    const points: TrendPoint[] = [];
    let madeTotal = 0;
    let settledTotal = 0;
    for (let y = firstYear, m = firstMonth; y < lastYear || (y === lastYear && m <= lastMonth); m === 12 ? (y += 1, m = 1) : m += 1) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        madeTotal += made.get(key) ?? 0;
        settledTotal += settled.get(key) ?? 0;
        points.push({ key, year: y, month: m, made: madeTotal, settled: settledTotal });
    }
    return points;
}

export interface Lifeline {
    number: number;
    title: string;
    group: ChartGroup;
    /** Day numbers (see dayNumber). */
    made: number;
    deadline: number | null;
    /** The verdict date, for promises that have one. */
    resolved: number | null;
}

export interface LifelineChart {
    rows: Lifeline[];
    /** The time window drawn, in day numbers. */
    from: number;
    to: number;
    today: number | null;
}

/** How far past today the timeline runs before distant deadlines are cut off. */
export const LIFELINE_LOOKAHEAD_DAYS = 365;

/**
 * Each promise as a span from the day it was made to its deadline, with its
 * verdict date, oldest first. The window ends a year from today (or at the
 * last verdict, if later) so a deadline years away does not squash the rest.
 */
export function lifelines(promises: readonly PromiseCardData[], today: string | null): LifelineChart {
    const rows: Lifeline[] = [];
    for (const p of promises) {
        const made = dayNumber(p.statementDate);
        if (made === null) continue;
        rows.push({
            number: p.number, title: p.title, group: chartGroup(p.state), made,
            deadline: dayNumber(p.deadlineDate),
            resolved: isOpenState(p.state) ? null : dayNumber(p.resolvedAt),
        });
    }
    rows.sort((a, b) => a.made - b.made || a.number - b.number);

    const todayDay = dayNumber(today);
    const from = rows.length ? rows[0].made : 0;
    const marks = rows.flatMap((r) => [r.made, r.resolved ?? r.made]);
    const horizon = todayDay === null ? Math.max(...marks, ...rows.map((r) => r.deadline ?? r.made)) : todayDay + LIFELINE_LOOKAHEAD_DAYS;
    const to = Math.max(from + 1, horizon, ...marks);
    return { rows, from, to, today: todayDay };
}
