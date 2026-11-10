// Exports the site's own icons as plain SVG markup for the share-card renderer.
//
//   bun scripts/og/export-icons.tsx        -> resources/og/icons.json
//
// The renderer (Node + resvg) cannot read React components or Tailwind classes,
// so this resolves both ahead of time. The source of truth stays where the app
// already keeps it: SITE_ICON_MAP (module icons) and lucide (small glyphs).
// Re-run after changing an icon; a test fails when the JSON is stale.

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import { SITE_ICON_MAP } from '../../resources/js/Lib/siteLinks';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'resources', 'og', 'icons.json');

/** Small single-colour glyphs used inside pills and meta rows. */
const GLYPHS = [
    'Hourglass', 'Wrench', 'AlarmClock', 'BadgeCheck', 'CircleDashed', 'XCircle', 'CalendarClock', 'Undo2',
    'Calendar', 'MapPin', 'Bus', 'Users', 'Vote', 'Route', 'Plane', 'Ship', 'Car', 'Globe', 'Hash', 'ArrowLeft',
    'Image', 'Landmark', 'TreePine', 'Utensils', 'Store', 'Mountain', 'Church', 'Eye', 'Building2', 'Gamepad2',
] as const;

type Theme = 'light' | 'dark';

/** `fill-[#3B82F6]/15` -> { fill: '#3B82F6', 'fill-opacity': '0.15' } */
function paintFromClass(token: string): Record<string, string> | null {
    const match = token.match(/^(fill|stroke)-\[(#[0-9a-fA-F]{3,8})\](?:\/(\d{1,3}))?$/);
    if (!match) return null;
    const [, prop, colour, alpha] = match;
    const paint: Record<string, string> = { [prop]: colour };
    if (alpha) paint[`${prop}-opacity`] = String(Number(alpha) / 100);
    return paint;
}

/** Turns the Tailwind colour classes on each element into SVG attributes for one theme. */
function resolveClasses(markup: string, theme: Theme): string {
    return markup.replace(/<([a-zA-Z]+)([^>]*?)(\/?)>/g, (_tag, name: string, rawAttrs: string, selfClose: string) => {
        const classMatch = rawAttrs.match(/\sclass="([^"]*)"/);
        if (!classMatch) return `<${name}${rawAttrs}${selfClose}>`;

        const resolved: Record<string, string> = {};
        const tokens = classMatch[1].split(/\s+/).filter(Boolean);
        // Base classes first, then the `dark:` overrides when drawing the dark colourway.
        for (const token of tokens.filter((t) => !t.includes(':'))) Object.assign(resolved, paintFromClass(token));
        if (theme === 'dark') {
            for (const token of tokens.filter((t) => t.startsWith('dark:'))) {
                const paint = paintFromClass(token.slice(5));
                if (!paint) continue;
                // A dark override replaces the colour and its opacity together.
                const prop = Object.keys(paint)[0];
                delete resolved[`${prop}-opacity`];
                Object.assign(resolved, paint);
            }
        }

        let attrs = rawAttrs.replace(classMatch[0], '');
        for (const prop of Object.keys(resolved)) attrs = attrs.replace(new RegExp(`\\s${prop}="[^"]*"`), '');
        const extra = Object.entries(resolved).map(([k, v]) => ` ${k}="${v}"`).join('');
        return `<${name}${attrs}${extra}${selfClose}>`;
    });
}

/** Splits `<svg ...>inner</svg>` into its viewBox, inherited paint attributes and inner markup. */
function unwrap(markup: string) {
    const open = markup.match(/^<svg([^>]*)>/);
    if (!open) throw new Error(`not an svg: ${markup.slice(0, 80)}`);
    const attr = (name: string) => open[1].match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
    const inherited = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']
        .map((name) => [name, attr(name)] as const)
        .filter(([, value]) => value !== undefined)
        .map(([name, value]) => ` ${name}="${value}"`)
        .join('');
    const inner = markup.slice(open[0].length, markup.lastIndexOf('</svg>'));
    return { viewBox: attr('viewBox') ?? '0 0 24 24', body: `<g${inherited}>${inner}</g>` };
}

export interface IconSet {
    icons: Record<string, { viewBox: string; light: string; dark: string }>;
    glyphs: Record<string, { viewBox: string; body: string }>;
}

/** Every module icon and glyph as plain SVG markup. */
export function buildIcons(): IconSet {
    const icons: IconSet['icons'] = {};
    for (const [key, Icon] of Object.entries(SITE_ICON_MAP)) {
        const markup = renderToStaticMarkup(createElement(Icon, { className: '' }));
        const light = unwrap(resolveClasses(markup, 'light'));
        const dark = unwrap(resolveClasses(markup, 'dark'));
        icons[key] = { viewBox: light.viewBox, light: light.body, dark: dark.body };
    }

    const glyphs: IconSet['glyphs'] = {};
    for (const name of GLYPHS) {
        const Icon = (lucide as Record<string, unknown>)[name] as React.ComponentType | undefined;
        if (!Icon) throw new Error(`lucide has no icon named ${name}`);
        glyphs[name] = unwrap(renderToStaticMarkup(createElement(Icon)));
    }

    return { icons, glyphs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const set = buildIcons();
    writeFileSync(OUT, `${JSON.stringify(set, null, 1)}\n`);
    console.log(`wrote ${Object.keys(set.icons).length} icons and ${Object.keys(set.glyphs).length} glyphs to resources/og/icons.json`);
}
