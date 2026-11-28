// Compiles every module icon from `resources/data/project-icons.json` into
// standalone, zero-Tailwind, zero-CSS-var SVG files for mobile apps and static
// consumers:
//
//   node scripts/export-module-icons.mjs
//
// Outputs:
//   public/assets/icons/modules/<key>.svg        (light variant)
//   public/assets/icons/modules/<key>-dark.svg   (dark variant)
//   public/assets/icons/modules/manifest.json    (aliases + per-file content hashes)

import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const ICONS_PATH = join(ROOT, 'resources', 'data', 'project-icons.json');
const TOKENS_PATH = join(ROOT, 'resources', 'og', 'tokens.json');
const OUT_DIR = join(ROOT, 'public', 'assets', 'icons', 'modules');

/** `fill-[#3B82F6]/15` -> { fill: '#3B82F6', 'fill-opacity': '0.15' } */
function paintFromClass(token) {
    const match = token.match(/^(fill|stroke)-\[(#[0-9a-fA-F]{3,8})\](?:\/(\d{1,3}))?$/);
    if (!match) return null;
    const [, prop, colour, alpha] = match;
    const paint = { [prop]: colour };
    if (alpha !== undefined) {
        paint[`${prop}-opacity`] = String(Number(alpha) / 100);
    }
    return paint;
}

/**
 * Turns Tailwind colour utility classes on each SVG child element into plain
 * SVG presentation attributes for one colourway (`light` or `dark`).
 */
function resolveClasses(markup, theme) {
    return markup.replace(/<([a-zA-Z]+)([^>]*?)(\/?)>/g, (_tag, name, rawAttrs, selfClose) => {
        const classMatch = rawAttrs.match(/\sclass="([^"]*)"/);
        if (!classMatch) return `<${name}${rawAttrs}${selfClose}>`;

        const resolved = {};
        const tokens = classMatch[1].split(/\s+/).filter(Boolean);

        // Base classes first, then `dark:` overrides when building the dark variant.
        for (const token of tokens) {
            if (token.includes(':')) continue;
            const paint = paintFromClass(token);
            if (paint) Object.assign(resolved, paint);
        }

        if (theme === 'dark') {
            for (const token of tokens) {
                if (!token.startsWith('dark:')) continue;
                const paint = paintFromClass(token.slice(5));
                if (!paint) continue;
                const prop = Object.keys(paint)[0];
                // A dark override replaces both the colour and its opacity together.
                delete resolved[`${prop}-opacity`];
                Object.assign(resolved, paint);
            }
        }

        let attrs = rawAttrs.replace(classMatch[0], '');
        for (const prop of Object.keys(resolved)) {
            attrs = attrs.replace(new RegExp(`\\s${prop}="[^"]*"`, 'g'), '');
        }

        const extra = Object.entries(resolved)
            .map(([k, v]) => ` ${k}="${v}"`)
            .join('');

        return `<${name}${attrs}${extra}${selfClose}>`;
    });
}

function compileSvg(viewBox, body, theme, primaryHex) {
    const resolvedBody = resolveClasses(body, theme).replaceAll('hsl(var(--primary))', primaryHex);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="32" height="32" fill="none">${resolvedBody}</svg>\n`;

    if (svg.includes('class=')) {
        throw new Error(`Compiled ${theme} SVG still contains a class attribute: ${svg.slice(0, 120)}`);
    }
    if (svg.includes('var(--')) {
        throw new Error(`Compiled ${theme} SVG still contains a CSS var(): ${svg.slice(0, 120)}`);
    }

    return svg;
}

function shortHash(content) {
    return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

function main() {
    const iconsFile = JSON.parse(readFileSync(ICONS_PATH, 'utf8'));
    const tokensFile = JSON.parse(readFileSync(TOKENS_PATH, 'utf8'));

    const lightPrimary = tokensFile?.light?.primary ?? '#3443A3';
    const darkPrimary = tokensFile?.dark?.primary ?? '#939FFF';
    const rawIcons = iconsFile?.icons ?? {};

    mkdirSync(OUT_DIR, { recursive: true });

    const aliases = {};
    const manifestIcons = {};
    const writtenFiles = new Set(['manifest.json']);
    const sortedKeys = Object.keys(rawIcons).sort();

    for (const key of sortedKeys) {
        const entry = rawIcons[key];
        if (!entry || typeof entry !== 'object') continue;

        if (typeof entry.alias === 'string' && entry.alias.trim() !== '') {
            aliases[key] = entry.alias.trim();
            continue;
        }

        if (typeof entry.viewBox !== 'string' || typeof entry.body !== 'string') {
            continue;
        }

        const lightSvg = compileSvg(entry.viewBox, entry.body, 'light', lightPrimary);
        const darkSvg = compileSvg(entry.viewBox, entry.body, 'dark', darkPrimary);

        const lightFilename = `${key}.svg`;
        const darkFilename = `${key}-dark.svg`;

        writeFileSync(join(OUT_DIR, lightFilename), lightSvg, 'utf8');
        writeFileSync(join(OUT_DIR, darkFilename), darkSvg, 'utf8');

        writtenFiles.add(lightFilename);
        writtenFiles.add(darkFilename);

        manifestIcons[key] = {
            light: shortHash(lightSvg),
            dark: shortHash(darkSvg),
        };
    }

    // Remove any stale SVGs from deleted icon keys.
    for (const file of readdirSync(OUT_DIR)) {
        if (file.endsWith('.svg') && !writtenFiles.has(file)) {
            unlinkSync(join(OUT_DIR, file));
        }
    }

    const versionHash = shortHash(
        JSON.stringify({
            lightPrimary,
            darkPrimary,
            aliases,
            icons: manifestIcons,
        }),
    );

    const manifest = {
        version: versionHash,
        aliases,
        icons: manifestIcons,
    };

    writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const count = Object.keys(manifestIcons).length;
    console.log(`Exported ${count} module icons (${count * 2} SVGs + manifest.json, v=${versionHash}) to public/assets/icons/modules/`);
}

main();
