import { describe, expect, it } from 'vitest';
import type { SmartFilterValue } from '@/Lib/smartFilterSearch';
import type { PromiseCardData } from '@/Domain/promises/types';
import { activeScoreboardState, canReturnToPromiseList, filterPromises, matchesState, narrowFromChart, promiseFilterFacets, promiseListUrl, promiseReturnUrl, readPromiseFilters, selectScoreboardState, visiblePromises } from './filters';

const facets = promiseFilterFacets({
    sectors: [{ id: 'energy', label: 'الكهرباء والطاقة', icon: null }, { id: 'health', label: 'الصحة', icon: null }],
    governorates: [{ id: 'damascus', label: 'دمشق' }],
    institutions: [], speakers: [], tags: ['ماء & طاقة'],
});
const empty: SmartFilterValue = { search: '', filters: {}, sort: 'urgency' };
const card = (id: string, patch: Partial<PromiseCardData> = {}): PromiseCardData => ({
    id, number: Number(id), title: 'تحسين الكهرباء', speaker: { id: 'speaker', name: 'أحمد', title: null, image: null },
    sector: { id: 'energy', label: 'الكهرباء والطاقة', icon: null }, institution: null,
    isNational: false, governorates: ['damascus'], tags: ['ماء & طاقة'],
    statementDate: '2025-01-01', deadlineDate: '2026-11-01', deadlineWording: null,
    status: 'pending', state: 'overdue', daysLeft: -1, daysSince: 1,
    counter: { mode: 'overdue', value: 1 }, keptLate: false, resolvedAt: null, target: null, votingOpen: true, ...patch,
});
const promises = [
    card('1'),
    card('2', { title: 'تحسين المشافي', sector: { id: 'health', label: 'الصحة', icon: null }, state: 'fulfilled', statementDate: '2025-02-01', deadlineDate: '2026-10-01', isNational: true, governorates: [], tags: [] }),
    card('3', { state: 'in_progress', daysLeft: 10, deadlineDate: null }),
];

describe('shareable promise filters', () => {
    it('round-trips filter values, tags and sorting without serializing free text', () => {
        const value = { search: 'كهرباء & ماء', sort: 'newest', filters: { sector: ['energy', 'health'], tag: ['ماء & طاقة'], governorate: ['national', 'damascus'] } };
        expect(readPromiseFilters(promiseListUrl(value), facets)).toEqual({ ...value, search: '' });
    });

    it('keeps free text local and ignores a q parameter in old links', () => {
        expect(promiseListUrl({ ...empty, search: 'ليسا' })).toBe('/promises');
        expect(readPromiseFilters('/promises?q=ليسا&state=overdue', facets)).toEqual({ ...empty, filters: { state: ['overdue'] } });
    });

    it('keeps old single-value links valid and rejects invalid/duplicate options', () => {
        expect(readPromiseFilters('/promises?state=overdue&sector=energy', facets)).toEqual({ ...empty, filters: { state: ['overdue'], sector: ['energy'] } });
        expect(readPromiseFilters('/promises?state=all&sector=bad&sector=energy&sector=energy&sort=bad', facets)).toEqual({ ...empty, filters: { sector: ['energy'] } });
    });

    it('restores PHP-normalized array indices after an HTTP or SSR visit', () => {
        expect(readPromiseFilters('/promises?state%5B0%5D=overdue&state%5B1%5D=broken&sector%5B%5D=energy&sector%5B%5D=health', facets).filters)
            .toEqual({ state: ['overdue', 'broken'], sector: ['energy', 'health'] });
    });

    it.each(['https://example.com/promises', '//example.com', '/promises/12', '/admin', '/promises#fragment'])('rejects a return context outside the list: %s', (from) => {
        expect(promiseReturnUrl(`/promises/1?from=${encodeURIComponent(from)}`)).toBe('/promises');
    });

    it('returns to the full filtered list from detail context', () => {
        const list = promiseListUrl({ ...empty, filters: { state: ['overdue', 'open'] } });
        expect(promiseReturnUrl(`/promises/1?from=${encodeURIComponent(list)}`)).toBe(list);
    });
});

describe('return to a remembered promise list', () => {
    const listUrl = '/promises?sector=energy&sort=newest';
    const detailUrl = `/promises/12?from=${encodeURIComponent(listUrl)}`;
    const visit = { detailUrl, listUrl };

    it('accepts the exact detail visit and its original filtered list', () => {
        expect(canReturnToPromiseList(visit, detailUrl)).toBe(true);
        expect(canReturnToPromiseList({ detailUrl: '/promises/12', listUrl: '/promises' }, '/promises/12')).toBe(true);
    });

    it('uses the list URL when no matching card visit was recorded', () => {
        expect(canReturnToPromiseList(undefined, detailUrl)).toBe(false);
        expect(canReturnToPromiseList({ detailUrl }, detailUrl)).toBe(false);
    });

    it('rejects another detail, changed return filters, and external destinations', () => {
        expect(canReturnToPromiseList(visit, detailUrl.replace('/12?', '/13?'))).toBe(false);
        expect(canReturnToPromiseList(visit, '/promises/12')).toBe(false);
        expect(canReturnToPromiseList({ ...visit, listUrl: '/promises' }, detailUrl)).toBe(false);
        expect(canReturnToPromiseList({ ...visit, listUrl: 'https://example.com' }, detailUrl)).toBe(false);
        expect(canReturnToPromiseList({ detailUrl: 'https://example.com/promises/12', listUrl: '/promises' }, 'https://example.com/promises/12')).toBe(false);
        expect(canReturnToPromiseList({ detailUrl: '/admin', listUrl: '/promises' }, '/admin')).toBe(false);
    });
});

describe('promise filtering semantics', () => {
    it('uses OR inside each facet and AND between facets', () => {
        const value = { ...empty, filters: { sector: ['energy', 'health'], governorate: ['national'], state: ['overdue', 'fulfilled'] } };
        expect(visiblePromises(filterPromises(promises, value), value, 30).map((p) => p.id)).toEqual(['2']);
    });

    it('applies Arabic-normalized text alongside multiple filters', () => {
        expect(filterPromises(promises, { ...empty, search: 'احمد', filters: { sector: ['energy'] } }).map((p) => p.id)).toEqual(['1', '3']);
    });

    it('leaves states out of the base set and includes overlapping matches once', () => {
        const value = { ...empty, filters: { state: ['due_soon', 'open'] } };
        expect(filterPromises(promises, value)).toHaveLength(3);
        expect(visiblePromises(promises, value, 30).map((p) => p.id)).toEqual(['3']);
        expect(matchesState(promises[0], 'due_soon', 30)).toBe(false);
    });

    it('preserves server urgency order, sorts copies and puts missing deadlines last', () => {
        expect(visiblePromises(promises, empty, 30).map((p) => p.id)).toEqual(['1', '2', '3']);
        expect(visiblePromises(promises, { ...empty, sort: 'deadline' }, 30).map((p) => p.id)).toEqual(['2', '1', '3']);
        expect(visiblePromises(promises, { ...empty, sort: 'newest' }, 30).map((p) => p.id)).toEqual(['2', '1', '3']);
        expect(promises.map((p) => p.id)).toEqual(['1', '2', '3']);
    });
});

describe('scoreboard tiles', () => {
    it('marks a tile active only when the list shows exactly its state', () => {
        expect(activeScoreboardState(empty)).toBeNull();
        expect(activeScoreboardState({ ...empty, filters: { state: ['overdue'], sector: [] } })).toBe('overdue');
        expect(activeScoreboardState({ ...empty, filters: { state: ['overdue', 'open'] } })).toBeUndefined();
        expect(activeScoreboardState({ ...empty, filters: { state: ['overdue'], sector: ['energy'] } })).toBeUndefined();
        expect(activeScoreboardState({ ...empty, search: 'كهرباء', filters: { state: ['overdue'] } })).toBeUndefined();
        expect(activeScoreboardState({ ...empty, search: 'كهرباء' })).toBeUndefined();
    });

    it('narrows to the clicked state alone so the list matches its global count, keeping the sort', () => {
        const busy = { search: 'كهرباء', sort: 'deadline', filters: { state: ['open', 'broken'], sector: ['energy'] } };
        expect(selectScoreboardState(busy, 'overdue')).toEqual({ search: '', sort: 'deadline', filters: { state: ['overdue'] } });
        expect(promiseListUrl(selectScoreboardState(empty, 'other'))).toBe('/promises?state=other');
    });

    it('returns to the full list from the total or the tile already shown', () => {
        const overdue = { ...empty, sort: 'newest', filters: { state: ['overdue'] } };
        expect(selectScoreboardState(overdue, 'overdue')).toEqual({ ...empty, sort: 'newest' });
        expect(selectScoreboardState(overdue, null)).toEqual({ ...empty, sort: 'newest' });
        expect(selectScoreboardState(overdue, 'fulfilled').filters).toEqual({ state: ['fulfilled'] });
    });
});

describe('narrowing from the charts view', () => {
    const shown = (value: SmartFilterValue) => visiblePromises(filterPromises(promises, value), value, 30);
    const withFilters = (filters: SmartFilterValue['filters']): SmartFilterValue => ({ ...empty, sort: 'newest', filters });

    it('replaces the picked filter and keeps the others and the sort', () => {
        expect(narrowFromChart(withFilters({ sector: ['energy', 'health'], tag: ['ماء & طاقة'] }), 'sector', 'health'))
            .toEqual(withFilters({ sector: ['health'], tag: ['ماء & طاقة'] }));
        expect(narrowFromChart(withFilters({ state: ['fulfilled', 'overdue'] }), 'state', 'overdue')).toEqual(withFilters({ state: ['overdue'] }));
    });

    it('keeps "due soon" when its promises are picked as open, instead of widening to every open promise', () => {
        const dueSoon = withFilters({ state: ['due_soon'] });
        const far = [...promises, card('4', { state: 'pending', daysLeft: 400 })];
        const next = narrowFromChart(dueSoon, 'state', 'open')!;
        expect(next.filters.state).toEqual(['due_soon']);
        expect(visiblePromises(filterPromises(far, next), next, 30).map((p) => p.id)).toEqual(['3']);
        expect(narrowFromChart(withFilters({ state: ['open', 'due_soon'] }), 'state', 'open')!.filters.state).toEqual(['open']);
    });

    it('refuses a co-speaker outside the selected officials, whose other promises are not shown', () => {
        expect(narrowFromChart(withFilters({ speaker: ['speaker'] }), 'speaker', 'other')).toBeNull();
        expect(narrowFromChart(withFilters({ speaker: ['speaker', 'other'] }), 'speaker', 'other')!.filters.speaker).toEqual(['other']);
        expect(shown(narrowFromChart(empty, 'speaker', 'speaker')!)).toHaveLength(3);
    });
});
