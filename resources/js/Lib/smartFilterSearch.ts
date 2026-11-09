import { normalizeArabic } from '@/Lib/arabic';

export interface SmartFilterOption {
    value: string;
    label: string;
    count?: number;
}

export interface SmartFilterFacet {
    key: string;
    label: string;
    aliases?: readonly string[];
    selectionMode?: 'single' | 'multiple';
    options: readonly SmartFilterOption[];
}

export interface SmartFilterValue {
    search: string;
    filters: Record<string, string[]>;
    sort: string;
}

/** Single picks replace; multiple picks toggle one value without losing siblings. */
export function toggleFilterValue(value: SmartFilterValue, facet: SmartFilterFacet, option: string): SmartFilterValue {
    const chosen = value.filters[facet.key] ?? [];
    const next = chosen.includes(option)
        ? chosen.filter((v) => v !== option)
        : facet.selectionMode === 'multiple' ? [...chosen, option] : [option];
    const filters = { ...value.filters };
    if (next.length) filters[facet.key] = next;
    else delete filters[facet.key];
    return { ...value, filters };
}

/** Only an explicit, recognised `facet:` expression composes a filter. */
export function parseFilterDraft(draft: string, facets: readonly SmartFilterFacet[]) {
    const colon = draft.lastIndexOf(':');
    if (colon !== -1) {
        const before = draft.slice(0, colon).trimEnd();
        for (const match of before.matchAll(/\S+/g)) {
            const name = normalizeArabic(before.slice(match.index));
            const facet = facets.find((f) => [f.label, ...(f.aliases ?? [])].some((n) => normalizeArabic(n) === name));
            if (facet) {
                const leading = draft.slice(0, match.index).trimEnd();
                return { facet, leading, search: leading, query: draft.slice(colon + 1).trim() };
            }
        }
    }

    const tail = /\S+$/.exec(draft);
    return {
        facet: undefined,
        leading: tail ? draft.slice(0, tail.index).trimEnd() : draft.trimEnd(),
        search: draft,
        query: tail?.[0] ?? '',
    };
}

export function matchesFilterText(text: string, query: string) {
    return normalizeArabic(text).includes(normalizeArabic(query));
}
