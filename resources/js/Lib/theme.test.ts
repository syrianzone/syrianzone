// The theme record lives in resources/data/themes.json: the pre-paint script and
// Lib/theme.ts read it, and app.css keys the shared dark tokens off data-scheme
// instead of listing dark ids. These tests pin those three facts, and that the
// static swatch palette copied into the data file still equals the CSS tokens it
// mirrors (the swatch grid cannot read a theme that is not applied).
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SYSTEM_THEME, THEME_REGISTRY, applyTheme } from './theme';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const css = read('../../css/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const blade = read('../../views/app.blade.php');

// Declarations of the rule whose selector list is exactly `selectors`, later rules winning.
function declarations(selectors: string[]): Record<string, string> {
  const wanted = selectors.join(',');
  const found: Record<string, string> = {};
  for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = rule[1].split(',').map((part) => part.trim()).join(',');
    if (selector !== wanted) continue;
    for (const declaration of rule[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      found[declaration[1]] = declaration[2].trim();
    }
  }
  return found;
}

const lightTokens = declarations([':root']);
const darkTokens = declarations(['[data-scheme="dark"]']);

function themeTokens(id: string, isDark: boolean): Record<string, string> {
  return {
    ...lightTokens,
    ...(isDark ? darkTokens : {}),
    ...declarations([`[data-theme="${id}"]`]),
  };
}

/** `105 15.2% 36.1%` -> `#556a4e`; an independent conversion of the CSS token. */
function hslToHex(value: string): string {
  const match = value.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  if (!match) throw new Error(`"${value}" is not an HSL triple`);
  const hue = Number(match[1]) / 30;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + hue) % 12;
    const scale = Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round((lightness - a * scale) * 255).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

describe('the single theme record', () => {
  it('declares a token block for every theme id', () => {
    for (const theme of THEME_REGISTRY) {
      if (theme.id === 'light') {
        expect(lightTokens['--background']).toBeDefined();
        continue;
      }
      if (theme.id === SYSTEM_THEME) continue;
      expect(Object.keys(declarations([`[data-theme="${theme.id}"]`])), theme.id).not.toHaveLength(0);
    }
  });

  it('keys the shared dark tokens and the dark variant off data-scheme only', () => {
    expect(darkTokens['--background']).toBeDefined();
    expect(css).toContain('@custom-variant dark (&:where([data-scheme="dark"], [data-scheme="dark"] *));');
    for (const theme of THEME_REGISTRY) {
      expect(css).not.toContain(`[data-theme="${theme.id}"],`);
    }
    expect(css).not.toMatch(/(^|[\s,])\.dark\b/);
  });

  it('declares color-scheme once per scheme', () => {
    const schemes = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map(([, selectorList, body]) => ({
        selectors: selectorList.split(',').map((s) => s.trim()),
        scheme: body.match(/color-scheme:\s*(light|dark)/)?.[1],
      }))
      .filter((rule) => rule.scheme);
    expect(schemes).toEqual([
      { selectors: [':root'], scheme: 'light' },
      { selectors: ['[data-theme="jasmine"]'], scheme: 'light' },
      { selectors: ['[data-scheme="dark"]'], scheme: 'dark' },
    ]);
  });

  it('keeps every static swatch colour equal to the token it mirrors', () => {
    const lightPrimary = hslToHex(lightTokens['--primary']);
    for (const theme of THEME_REGISTRY) {
      if (theme.id === SYSTEM_THEME) {
        const light = THEME_REGISTRY.find((entry) => entry.id === 'light');
        expect(theme.primary, theme.id).toBe(light?.primary);
        expect(theme.primary, theme.id).toBe(lightPrimary);
        continue;
      }
      const tokens = themeTokens(theme.id, theme.isDark);
      expect(theme.bg.toLowerCase(), `${theme.id} bg`).toBe(hslToHex(tokens['--background']));
      expect(theme.primary.toLowerCase(), `${theme.id} primary`).toBe(hslToHex(tokens['--primary']));
    }
  });

  it('prints the dark ids from the data file instead of a hand-written list', () => {
    expect(blade).toContain("resource_path('data/themes.json')");
    expect(blade).toContain('@json($darkThemeIds)');
    expect(blade).not.toMatch(/dark-blue|dark-purple|dark-green|high-contrast|damascus-rose|jasmine/);
  });

  it('sets meta color-scheme in the head before the pre-paint script', () => {
    const meta = '<meta name="color-scheme" content="light dark">';
    const metaAt = blade.indexOf(meta);
    const scriptAt = blade.indexOf('data-theme');
    expect(metaAt).toBeGreaterThan(-1);
    expect(scriptAt).toBeGreaterThan(metaAt);
  });
});

describe('applyTheme', () => {
  // Minimal document stub: applyTheme only touches <html ...> and the
  // color-scheme meta, so nothing here needs a real DOM.
  function withDocument(metaPresent: boolean, assertions: (calls: string[]) => void) {
    const calls: string[] = [];
    const meta = { setAttribute: (name: string, value: string) => calls.push(`meta.${name}=${value}`) };
    const previous = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = {
      documentElement: { setAttribute: (name: string, value: string) => calls.push(`html.${name}=${value}`) },
      querySelector: () => (metaPresent ? meta : null),
    };
    try {
      assertions(calls);
    } finally {
      (globalThis as { document?: unknown }).document = previous;
    }
  }

  it('sets the theme and its scheme together', () => {
    withDocument(true, (calls) => {
      for (const theme of THEME_REGISTRY.filter((entry) => entry.id !== SYSTEM_THEME)) {
        calls.length = 0;
        applyTheme(theme.id);
        const scheme = theme.isDark ? 'dark' : 'light';
        expect(calls).toEqual([
          `html.data-theme=${theme.id}`,
          `html.data-scheme=${scheme}`,
          `meta.content=${scheme}`,
        ]);
      }
    });
  });

  it('does nothing when the meta is absent', () => {
    withDocument(false, () => {
      expect(() => applyTheme('dark')).not.toThrow();
    });
  });
});
