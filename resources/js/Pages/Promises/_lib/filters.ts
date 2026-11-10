import { normalizeArabic } from '@/Lib/arabic';
import type { SmartFilterFacet, SmartFilterOption, SmartFilterValue } from '@/Lib/smartFilterSearch';
import type { Option, PromiseCardData, SectorOption } from './types';

export interface PromiseFilterOptions {
    sectors: SectorOption[];
    governorates: Option[];
    institutions: Array<{ id: string; name: string }>;
    speakers: Array<{ id: string; name: string }>;
    tags: string[];
}

export const STATE_FILTERS = [
    { value: 'overdue', label: 'متأخرة' },
    { value: 'due_soon', label: 'تقترب مواعيدها' },
    { value: 'open', label: 'لم تُحسم بعد' },
    { value: 'fulfilled', label: 'تحققت' },
    { value: 'partial', label: 'تحققت جزئياً' },
    { value: 'broken', label: 'لم تتحقق' },
    { value: 'other', label: 'أُجّلت أو سُحبت' },
] as const;

export const SORT_OPTIONS: readonly SmartFilterOption[] = [
    { value: 'urgency', label: 'الأكثر إلحاحاً' },
    { value: 'deadline', label: 'الأقرب موعداً' },
    { value: 'newest', label: 'الأحدث تصريحاً' },
];

export function promiseFilterFacets(options: PromiseFilterOptions): SmartFilterFacet[] {
    const facets: SmartFilterFacet[] = [
        { key: 'state', label: 'الحالة', aliases: ['حالة'], options: STATE_FILTERS },
        { key: 'sector', label: 'القطاع', aliases: ['قطاع'], options: options.sectors.map((o) => ({ value: o.id, label: o.label })) },
        { key: 'governorate', label: 'المحافظة', aliases: ['محافظة'], options: [{ value: 'national', label: 'على مستوى البلاد' }, ...options.governorates.map((o) => ({ value: o.id, label: o.label }))] },
        { key: 'speaker', label: 'صاحب الوعد', aliases: ['المسؤول', 'مسؤول'], options: options.speakers.map((o) => ({ value: o.id, label: o.name })) },
    ];
    if (options.institutions.length) facets.push({ key: 'institution', label: 'الجهة المسؤولة', aliases: ['الجهة', 'جهة'], options: options.institutions.map((o) => ({ value: o.id, label: o.name })) });
    if (options.tags.length) facets.push({ key: 'tag', label: 'الوسم', aliases: ['وسم'], options: options.tags.map((tag) => ({ value: tag, label: `#${tag}` })) });
    return facets.map((facet) => ({ ...facet, selectionMode: 'multiple' }));
}

/** Accept scalar links and PHP arrays, including Inertia's normalized indices. */
export function readPromiseFilters(url: string, facets: readonly SmartFilterFacet[]): SmartFilterValue {
    const params = new URL(url, 'https://local.invalid').searchParams;
    const filters: SmartFilterValue['filters'] = {};
    for (const facet of facets) {
        const candidates = [...params].filter(([key]) => key === facet.key || key === `${facet.key}[]`
            || key.startsWith(`${facet.key}[`) && /^\d+\]$/.test(key.slice(facet.key.length + 1))).map(([, v]) => v);
        const valid = [...new Set(candidates)].filter((v) => facet.options.some((o) => o.value === v));
        if (valid.length) filters[facet.key] = valid;
    }
    return {
        search: '',
        sort: SORT_OPTIONS.some((o) => o.value === params.get('sort')) ? params.get('sort')! : 'urgency',
        filters,
    };
}

export function promiseListUrl(value: SmartFilterValue): string {
    const params = new URLSearchParams();
    for (const [key, values] of Object.entries(value.filters)) {
        for (const option of values) params.append(values.length > 1 ? `${key}[]` : key, option);
    }
    if (value.sort !== 'urgency') params.set('sort', value.sort);
    return `/promises${params.size ? `?${params}` : ''}`;
}

/** Detail-page return context is restricted to this local list route. */
export function promiseReturnUrl(detailUrl: string): string {
    const from = new URL(detailUrl, 'https://local.invalid').searchParams.get('from');
    return from && /^\/promises(?:\?[^#]*)?$/.test(from) ? from : '/promises';
}

export const PROMISE_LIST_VISIT_KEY = 'promises.listVisit';

/** Only a matching detail history entry can return to its original list. */
export function canReturnToPromiseList(visit: unknown, detailUrl: string): boolean {
    if (!visit || typeof visit !== 'object' || !/^\/promises\/\d+(?:\?[^#]*)?$/.test(detailUrl)) return false;
    const context = visit as Record<string, unknown>;
    return context.detailUrl === detailUrl && context.listUrl === promiseReturnUrl(detailUrl);
}

export function matchesState(p: PromiseCardData, state: string, dueSoonDays: number): boolean {
    switch (state) {
        case 'overdue': return p.state === 'overdue';
        case 'due_soon': return (p.state === 'pending' || p.state === 'in_progress') && p.daysLeft !== null && p.daysLeft <= dueSoonDays;
        case 'open': return p.state === 'pending' || p.state === 'in_progress';
        case 'fulfilled': return p.state === 'fulfilled';
        case 'partial': return p.state === 'partially_fulfilled';
        case 'broken': return p.state === 'broken';
        case 'other': return p.state === 'postponed' || p.state === 'retracted';
        default: return false;
    }
}

/** Leave state filtering to visiblePromises so status counts use this full set. */
export function filterPromises(promises: PromiseCardData[], value: SmartFilterValue): PromiseCardData[] {
    const needle = normalizeArabic(value.search);
    const any = (key: string, matches: (v: string) => boolean) => !value.filters[key]?.length || value.filters[key].some(matches);
    return promises.filter((p) => (
        any('sector', (v) => p.sector?.id === v)
        && any('governorate', (v) => v === 'national' ? p.isNational : p.governorates.includes(v))
        && any('institution', (v) => p.institution?.id === v)
        && any('speaker', (v) => p.speaker.id === v)
        && any('tag', (v) => p.tags.includes(v))
        && (!needle || normalizeArabic(`${p.title} ${p.speaker.name ?? ''}`).includes(needle))
    ));
}

export function visiblePromises(base: PromiseCardData[], value: SmartFilterValue, dueSoonDays: number): PromiseCardData[] {
    const list = base.filter((p) => !value.filters.state?.length || value.filters.state.some((s) => matchesState(p, s, dueSoonDays)));
    if (value.sort === 'newest') return [...list].sort((a, b) => b.statementDate.localeCompare(a.statementDate));
    if (value.sort === 'deadline') return [...list].sort((a, b) => (a.deadlineDate ?? '9999').localeCompare(b.deadlineDate ?? '9999'));
    return list;
}
