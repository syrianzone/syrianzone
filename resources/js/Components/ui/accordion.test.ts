import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, nextSelection } from './accordion';

/**
 * The accordion is built on <details>/<summary> so collapsed content stays in
 * the DOM: the browser's find-in-page and in-page anchors reach it, and the
 * browser then opens the item itself. These tests pin that markup (the runner
 * is a server-render one — see the todos at the bottom for the click checks).
 */

type OwnProps = { type?: 'single' | 'multiple'; value?: string | string[]; defaultValue?: string };

function item(value: string, label: string, body: string) {
    return h(AccordionItem, {
        key: value,
        value,
        children: [
            h(AccordionTrigger, { key: 'trigger', children: label }),
            h(AccordionContent, { key: 'content', children: h('p', null, body) }),
        ],
    });
}

function render(own: OwnProps = {}): string {
    return renderToStaticMarkup(
        h(Accordion, {
            ...own,
            children: [item('one', 'الأول', 'محتوى الأول'), item('two', 'الثاني', 'محتوى الثاني')],
        }),
    );
}

// Each item is what follows its `<details`; the `open` attribute, when present,
// is the first thing in that tag prefix.
const items = (html: string) => html.split('<details').slice(1);
const tagHead = (text: string) => text.slice(0, text.indexOf('>'));
const isOpen = (text: string) => /\sopen=""/.test(tagHead(text));
const openCount = (html: string) => items(html).filter(isOpen).length;

describe('accordion', () => {
    it('keeps collapsed content in the DOM', () => {
        const html = render();

        expect(openCount(html)).toBe(0);
        // Both panels are closed, yet both are rendered: find-in-page and
        // in-page anchors can reach them.
        expect(html).toContain('محتوى الأول');
        expect(html).toContain('محتوى الثاني');
    });

    it('renders the closed panel of a partly open accordion', () => {
        const html = render({ defaultValue: 'one' });
        const [first, second] = items(html);

        expect(openCount(html)).toBe(1);
        expect(isOpen(first)).toBe(true);
        expect(isOpen(second)).toBe(false);
        expect(second).toContain('محتوى الثاني');
    });

    it('opens only the active item in single mode', () => {
        const html = render({ type: 'single', value: 'two' });
        const [first, second] = items(html);

        expect(openCount(html)).toBe(1);
        expect(isOpen(first)).toBe(false);
        expect(isOpen(second)).toBe(true);
    });

    it('keeps several panels open in multiple mode', () => {
        const html = render({ type: 'multiple', value: ['one', 'two'] });

        expect(openCount(html)).toBe(2);
    });

    it('replaces the open panel in single mode and toggles in multiple', () => {
        expect(nextSelection('single', [], 'one')).toEqual(['one']);
        expect(nextSelection('single', ['one'], 'two')).toEqual(['two']);
        expect(nextSelection('single', ['one'], 'one')).toEqual([]);
        expect(nextSelection('multiple', ['one'], 'two')).toEqual(['one', 'two']);
        expect(nextSelection('multiple', ['one', 'two'], 'one')).toEqual(['two']);
    });

    it('uses a native summary trigger, without duplicating its state', () => {
        const html = render({ defaultValue: 'one' });
        const summary = html.match(/<summary[^>]*>/)?.[0] ?? '';

        expect(summary).not.toBe('');
        // <summary> exposes expanded state itself; aria-expanded would double it.
        expect(html).not.toContain('aria-expanded');
        expect(html).not.toContain('type="button"');
        expect(html).toContain('الأول');
        // Hidden native marker, logical alignment and a visible keyboard focus.
        expect(summary).toMatch(/(^|\s)list-none(\s|")/);
        expect(summary).toContain('-webkit-details-marker]:hidden');
        expect(summary).toMatch(/(^|\s)text-start(\s|")/);
        expect(summary).toContain('focus-visible:ring-2');
        expect(summary).not.toMatch(/(^|\s)focus:outline-none/);
    });
});
