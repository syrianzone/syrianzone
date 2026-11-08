import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guards popup enter/exit motion against Tailwind v3 leftovers that break under v4.

const jsRoot = fileURLToPath(new URL('../..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(tsx?|jsx?)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

const filesMatching = (pattern: RegExp) =>
  sourceFiles(jsRoot)
    .filter((file) => pattern.test(readFileSync(file, 'utf8')))
    .map((file) => relative(jsRoot, file));

describe('popup animations', () => {
  it('uses tw-animate-css, not the v3 tailwindcss-animate plugin', () => {
    // Under v4 the old plugin has no default duration: animations ran in 0s.
    const appCss = readFileSync(join(jsRoot, '../css/app.css'), 'utf8');
    expect(appCss).toMatch(/@import\s+["']tw-animate-css["']/);
    expect(appCss).not.toMatch(/@plugin\s+["']tailwindcss-animate/);
  });

  it('has no v3 slide-from-half centring offsets', () => {
    // They stack with v4's `translate` centring and fly popups in from a corner.
    expect(filesMatching(/slide-(?:in-from|out-to)-[a-z]+-(?:1\/2|\[4[89]%\]|\[50%\])/)).toEqual([]);
  });

  it('references CSS variables as `(--var)`, not v3 `[--var]`', () => {
    // v4 compiles `origin-[--x]` to the invalid `transform-origin: --x`.
    expect(filesMatching(/\b[a-z][a-z-]*-\[--[\w-]+\]/)).toEqual([]);
  });
});
