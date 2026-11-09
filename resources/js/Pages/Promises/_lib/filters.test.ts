import { describe, expect, it } from 'vitest';
import type { SmartFilterValue } from '@/Lib/smartFilterSearch';
import type { PromiseCardData } from './types';
import { filterPromises, matchesState, promiseFilterFacets, promiseListUrl, promiseReturnUrl, readPromiseFilters, visiblePromises } from './filters';

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
    counter: { mode: 'overdue', value: 1 }, keptLate: false, resolvedAt: null, target: null, ...patch,
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
