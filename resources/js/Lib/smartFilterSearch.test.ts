import { describe, expect, it } from 'vitest';
import { matchesFilterText, parseFilterDraft, toggleFilterValue, type SmartFilterFacet, type SmartFilterValue } from './smartFilterSearch';

const facets: SmartFilterFacet[] = [
    { key: 'state', label: 'الحالة', aliases: ['حالة'], options: [{ value: 'partial', label: 'تحققت جزئياً' }] },
    { key: 'sector', label: 'القطاع', selectionMode: 'multiple', options: [{ value: 'energy', label: 'الكهرباء والطاقة' }] },
    { key: 'speaker', label: 'صاحب الوعد', aliases: ['المسؤول'], options: [] },
];

describe('filter draft composition', () => {
    it.each(['كهرباء', 'الحالة', 'وعد كهرباء', 'كهرباء '])('keeps %s as free text until an explicit filter expression', (text) => {
        expect(parseFilterDraft(text, facets).search).toBe(text);
        expect(parseFilterDraft(text, facets).facet).toBeUndefined();
    });

    it.each(['الحالة:متأخرة', 'الحالة: متأخرة', 'حالة :  متأخرة'])('accepts flexible colon spacing in %s', (draft) => {
        expect(parseFilterDraft(draft, facets)).toMatchObject({ facet: facets[0], search: '', query: 'متأخرة' });
    });

    it('preserves the search preceding an expression and multi-word values', () => {
        expect(parseFilterDraft('كهرباء الحالة: تحققت جزئياً', facets)).toMatchObject({ search: 'كهرباء', leading: 'كهرباء', query: 'تحققت جزئياً' });
    });

    it('recognises multi-word facet names, aliases and Arabic spelling variants', () => {
        expect(parseFilterDraft('ترميم صاحب الوعد: أحمد الشرع', facets)).toMatchObject({ search: 'ترميم', facet: facets[2], query: 'أحمد الشرع' });
        expect(parseFilterDraft('المسوول: احمد', facets).facet).toBe(facets[2]);
    });

    it('leaves unknown colons and names embedded in another word searchable', () => {
        expect(parseFilterDraft('موعد: صباحاً', facets).search).toBe('موعد: صباحاً');
        expect(parseFilterDraft('مالحالة: متأخرة', facets).facet).toBeUndefined();
    });

    it('uses the shared Arabic normalisation when matching suggestions', () => {
        expect(matchesFilterText('الكهرباء والطاقة', 'طاقه')).toBe(true);
        expect(matchesFilterText('أُجّلت أو سُحبت', 'اجلت')).toBe(true);
    });
});

describe('selection modes', () => {
    const value: SmartFilterValue = { search: 'وعد', sort: 'newest', filters: { sector: ['energy', 'health'], state: ['open'] } };

    it('adds multiple choices and removes only the picked value without mutation', () => {
        expect(toggleFilterValue(value, facets[1], 'housing').filters.sector).toEqual(['energy', 'health', 'housing']);
        expect(toggleFilterValue(value, facets[1], 'energy').filters).toEqual({ sector: ['health'], state: ['open'] });
        expect(value.filters.sector).toEqual(['energy', 'health']);
    });

    it('replaces an existing value for a single-choice group', () => {
        expect(toggleFilterValue(value, facets[0], 'partial')).toEqual({ ...value, filters: { ...value.filters, state: ['partial'] } });
    });

    it('drops an empty facet while preserving search, sort and other facets', () => {
        expect(toggleFilterValue(value, facets[0], 'open')).toEqual({ ...value, filters: { sector: ['energy', 'health'] } });
    });
});
