// Guards the theme <-> color-scheme mapping against drift. THEME_REGISTRY (via
// its isDark flag) is the source of truth; app.css declares color-scheme per
// theme and app.blade.php repeats the dark-theme ids because its pre-paint
// script runs before any module can load.
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { SYSTEM_THEME, THEME_REGISTRY, applyTheme } from './theme';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const css = read('../../css/app.css').replace(/\/\*[\s\S]*?\*\//g, '');
const blade = read('../../views/app.blade.php');

// Every rule that sets color-scheme, keyed by the exact selectors it lists.
const schemeRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selectorList, body]) => ({
    selectors: selectorList.split(',').map((s) => s.trim()),
    scheme: body.match(/color-scheme:\s*(light|dark)/)?.[1],
  }))
  .filter((rule) => rule.scheme);

// Later rules win, so take the last declaration matching the selector.
function declaredScheme(selector: string): string | undefined {
  const matches = schemeRules.filter((rule) => rule.selectors.includes(selector));
  return matches.at(-1)?.scheme;
}

// The light themes render with the :root defaults; every other theme has its own
// selector block (the dark ones share one combined block).
const schemeOf = (id: string, isDark: boolean) =>
  declaredScheme(`[data-theme="${id}"]`) ?? (isDark ? undefined : declaredScheme(':root'));

describe('theme color-scheme', () => {
  it('declares a matching color-scheme for every concrete theme', () => {
    const concrete = THEME_REGISTRY.filter((theme) => theme.id !== SYSTEM_THEME);
    const mapping = concrete.map((theme) => [theme.id, schemeOf(theme.id, theme.isDark)]);
    expect(mapping).toEqual(
      concrete.map((theme) => [theme.id, theme.isDark ? 'dark' : 'light']),
    );
  });

  it('keeps the blade pre-paint dark-theme list equal to the registry', () => {
    const list = blade.match(/var darkThemes = \[([^\]]*)\];/)?.[1] ?? '';
    const ids = [...list.matchAll(/'([^']+)'/g)].map(([, id]) => id).sort();
    const dark = THEME_REGISTRY.filter((theme) => theme.isDark).map((theme) => theme.id).sort();
    expect(ids).toEqual(dark);
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
  // Minimal document stub: applyTheme only touches <html data-theme> and the
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

  it('switches <html data-theme> and the meta together', () => {
    withDocument(true, (calls) => {
      applyTheme('damascus-rose');
      applyTheme('jasmine');
      expect(calls).toEqual([
        'html.data-theme=damascus-rose',
        'meta.content=dark',
        'html.data-theme=jasmine',
        'meta.content=light',
      ]);
    });
  });

  it('does nothing when the meta is absent', () => {
    withDocument(false, () => {
      expect(() => applyTheme('dark')).not.toThrow();
    });
  });
});
