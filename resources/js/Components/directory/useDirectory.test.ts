import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useDirectory, type DirectoryConfig, type DirectoryFacet } from './useDirectory';

interface Row {
    id: string;
    name: string;
    type: string;
    platforms: string[];
}

const ROWS: Row[] = [
    { id: 'a', name: 'أحمد', type: 'person', platforms: ['android'] },
    { id: 'b', name: 'احمد', type: 'person', platforms: ['apple'] },
    { id: 'c', name: 'مؤسسة', type: 'org', platforms: ['android', 'official'] },
    { id: 'd', name: 'زميل', type: 'org', platforms: [] },
];

const TYPE_FACET: DirectoryFacet<Row> = {
    key: 'type',
    label: 'النوع',
    options: [{ value: 'person', label: 'شخص' }, { value: 'org', label: 'منظمة' }],
    valueOf: (row) => row.type,
};

const PLATFORM_FACET: DirectoryFacet<Row> = {
    key: 'platform',
    label: 'المنصة',
    selectionMode: 'multiple',
    options: [{ value: 'android', label: 'أندرويد' }, { value: 'apple', label: 'آيفون' }, { value: 'official', label: 'الموقع' }],
    valueOf: (row) => row.platforms,
};

/** The hook is exercised through a component, the way a page uses it. */
function render(config: DirectoryConfig<Row>) {
    let snapshot: ReturnType<typeof useDirectory<Row>> | null = null;

    function Probe() {
        snapshot = useDirectory(config);
        return createElement('p', null, snapshot.results.map((row) => row.id).join(','));
    }

    const html = ReactDOMServer.renderToStaticMarkup(createElement(Probe));
    if (snapshot === null) throw new Error('the hook did not run');
    return { html, state: snapshot as ReturnType<typeof useDirectory<Row>> };
}

describe('directory search and facets', () => {
    it('folds the Arabic spelling variants in both the query and the item', () => {
        expect(render({ items: ROWS, searchText: (row) => row.name, initialQuery: 'أحمد' }).html).toContain('a,b');
        expect(render({ items: ROWS, searchText: (row) => row.name, initialQuery: 'احمد' }).html).toContain('a,b');
        expect(render({ items: ROWS, searchText: (row) => row.name, initialQuery: 'مؤسسة' }).html).toContain('c');
    });

    it('keeps a resource-specific matcher when plain text is not the rule', () => {
        const { html } = render({
            items: ROWS,
            search: (row, query) => row.type === query,
            initialQuery: 'org',
        });

        expect(html).toContain('c,d');
    });

    it('ands facets together and ors the values inside one', () => {
        const { html } = render({
            items: ROWS,
            facets: [TYPE_FACET, PLATFORM_FACET],
            initialFilters: { type: ['org'], platform: ['android', 'official'] },
        });

        expect(html).toContain('c');
        expect(html).not.toContain('d');
    });

    it('applies the configured sort after filtering', () => {
        const { html } = render({
            items: ROWS,
            facets: [TYPE_FACET],
            initialFilters: { type: ['person'] },
            sort: (a, b) => a.id.localeCompare(b.id),
        });

        expect(html).toContain('a,b');
    });

    it('pages the results and reports whether more remain', () => {
        const { html, state } = render({ items: ROWS, pageSize: 2 });

        expect(html).toContain('a,b');
        expect(state.shown).toBe(2);
        expect(state.total).toBe(4);
        expect(state.hasMore).toBe(true);
    });

    it('renders everything when no page size is configured', () => {
        const { state } = render({ items: ROWS });

        expect(state.visible).toHaveLength(4);
        expect(state.hasMore).toBe(false);
    });

    it('exposes the facets to the smart search field without their value maps', () => {
        const { state } = render({ items: ROWS, facets: [TYPE_FACET] });

        expect(state.searchFacets).toEqual([{
            key: 'type',
            label: 'النوع',
            aliases: undefined,
            selectionMode: undefined,
            options: TYPE_FACET.options,
        }]);
    });

    it('counts what matches, not what was passed in', () => {
        const { state } = render({
            items: ROWS,
            facets: [TYPE_FACET],
            initialFilters: { type: ['org'] },
        });

        expect(state.total).toBe(state.results.length);
        expect(state.total).toBe(2);
    });

    it('reads facet state from the page when it is controlled', () => {
        const { state } = render({ items: ROWS, facets: [TYPE_FACET], filters: { type: ['org'] } });

        expect(state.results.map((row) => row.id)).toEqual(['c', 'd']);
    });
});
