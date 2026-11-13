import { useCallback, useMemo, useState } from 'react';
import { matchesFilterText, type SmartFilterFacet, type SmartFilterValue } from '@/Lib/smartFilterSearch';

export interface DirectoryFacetOption {
    value: string;
    label: string;
}

export interface DirectoryFacet<T> {
    key: string;
    label: string;
    /** Extra names a `facet: value` expression accepts in the smart search field. */
    aliases?: readonly string[];
    /** `multiple` lets one item carry several values of the facet (an app's platforms). */
    selectionMode?: 'single' | 'multiple';
    options: readonly DirectoryFacetOption[];
    /** The item's value(s) for this facet; empty/absent means "not in this facet". */
    valueOf: (item: T) => string | readonly string[] | null | undefined;
}

export interface DirectoryConfig<T> {
    items: readonly T[];
    /** Everything a query is matched against, folded with the shared Arabic normalisation. */
    searchText?: (item: T) => string;
    /** For a resource whose matching is not plain text (a phone number, say). */
    search?: (item: T, query: string) => boolean;
    facets?: readonly DirectoryFacet<T>[];
    /** Order of the results, after filtering. Defaults to the order of `items`. */
    sort?: (a: T, b: T) => number;
    /** Results per "page"; 0 or absent renders every result and hides "load more". */
    pageSize?: number;
    initialQuery?: string;
    /** Seeds the chosen values, so a link or the page URL can open a facet. */
    initialFilters?: Record<string, string[]>;
    /** Controlled facet state, for a page whose filter chips another control owns. */
    filters?: Record<string, string[]>;
}

export interface Directory<T> {
    query: string;
    setQuery: (query: string) => void;
    /** The chosen values per facet key. */
    filters: Record<string, string[]>;
    setFilters: (filters: Record<string, string[]>) => void;
    /** The same state in the shape `SmartFilterSearch` owns. */
    value: SmartFilterValue;
    setValue: (value: SmartFilterValue) => void;
    /** The facets without the per-resource `valueOf`, for the smart search field. */
    searchFacets: SmartFilterFacet[];
    clear: () => void;
    isFiltered: boolean;
    /** Everything that matches, in the configured order. */
    results: T[];
    /** The part of `results` the page renders today. */
    visible: T[];
    /** `results.length`: the number of items that match, for "X of Y". */
    total: number;
    shown: number;
    hasMore: boolean;
    loadMore: () => void;
}

function facetValues<T>(facet: DirectoryFacet<T>, item: T): readonly string[] {
    const value = facet.valueOf(item);
    if (value === null || value === undefined) return [];
    return typeof value === 'string' ? (value ? [value] : []) : value;
}

/**
 * The search, filter and paging state every directory page shares: one query,
 * one chosen-value list per facet (AND between facets, OR inside one), an
 * optional sort and an optional page size that "load more" grows.
 *
 * Presentation stays with the page — the card, the table, the copy and the
 * page size are its own — so the same hook drives a grid and a table.
 */
export function useDirectory<T>(config: DirectoryConfig<T>): Directory<T> {
    const {
        items, searchText, search, facets = [], sort, pageSize = 0,
        initialQuery = '', initialFilters = {},
    } = config;
    const [query, setQuery] = useState(initialQuery);
    const [ownFilters, setOwnFilters] = useState<Record<string, string[]>>(initialFilters);
    const filters = config.filters ?? ownFilters;

    // A new query or filter set shows the first page again; comparing the key
    // instead of resetting in an effect keeps that true in the same render.
    const stateKey = `${query}\u0000${JSON.stringify(filters)}`;
    const [paging, setPaging] = useState({ key: stateKey, limit: pageSize });
    const limit = paging.key === stateKey ? paging.limit : pageSize;

    const searchFacets = useMemo<SmartFilterFacet[]>(() => facets.map((facet) => ({
        key: facet.key,
        label: facet.label,
        aliases: facet.aliases,
        selectionMode: facet.selectionMode,
        options: facet.options,
    })), [facets]);

    const results = useMemo(() => {
        const term = query.trim();
        const matched = items.filter((item) => {
            if (term) {
                if (search) {
                    if (!search(item, term)) return false;
                } else if (searchText) {
                    if (!matchesFilterText(searchText(item), term)) return false;
                }
            }

            for (const facet of facets) {
                const chosen = filters[facet.key];
                if (!chosen || chosen.length === 0) continue;
                const values = facetValues(facet, item);
                if (!values.some((value) => chosen.includes(value))) return false;
            }

            return true;
        });

        return sort ? matched.sort(sort) : matched;
    }, [items, query, search, searchText, facets, filters, sort]);

    const visible = pageSize > 0 ? results.slice(0, limit) : results;

    /** Empty selections are dropped, so `filters` only ever names active facets. */
    const emitFilters = useCallback((next: Record<string, string[]>) => {
        const cleaned: Record<string, string[]> = {};
        for (const [key, values] of Object.entries(next)) {
            if (values.length > 0) cleaned[key] = values;
        }
        setOwnFilters(cleaned);
    }, []);

    const clear = useCallback(() => {
        setQuery('');
        emitFilters({});
    }, [emitFilters]);

    const setValue = useCallback((value: SmartFilterValue) => {
        setQuery(value.search);
        emitFilters(value.filters);
    }, [emitFilters]);

    const value = useMemo<SmartFilterValue>(() => ({ search: query, filters, sort: '' }), [query, filters]);

    return {
        query, setQuery,
        filters, setFilters: emitFilters, value, setValue, searchFacets, clear,
        isFiltered: query.trim() !== '' || Object.keys(filters).length > 0,
        results,
        visible,
        total: results.length,
        shown: visible.length,
        hasMore: visible.length < results.length,
        loadMore: () => setPaging({ key: stateKey, limit: limit + pageSize }),
    };
}
