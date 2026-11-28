/**
 * Structural layout guardrails across React TSX pages and chrome.
 *
 * Prevents page width and double-padding regressions:
 *  - No page nests <PageHeader> inside <PageBody> (PageHeader already wraps its
 *    own PageShell, so nesting doubles horizontal padding and misaligns edges).
 *  - Navbar.tsx never combines Tailwind's `.container` with `max-w-[76rem]`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const JS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.join(JS_DIR, 'Pages');

function walkTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkTsx(full);
    if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx')) {
      return [full];
    }
    return [];
  });
}

function toRelative(file: string): string {
  return path.relative(JS_DIR, file).split(path.sep).join('/');
}

/** Strip block and line comments so JSDoc examples do not trigger structural rules. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:\\])\/\/.*$/gm, '$1');
}

function hasPageHeaderInsidePageBody(source: string): boolean {
  const tokenRe = /<PageBody\b[^>]*\/?>|<\/PageBody>|<PageHeader\b/g;
  let depth = 0;

  for (const match of source.matchAll(tokenRe)) {
    const token = match[0];
    if (token.startsWith('</PageBody')) {
      depth = Math.max(0, depth - 1);
    } else if (token.startsWith('<PageBody')) {
      if (!token.endsWith('/>')) {
        depth += 1;
      }
    } else if (token.startsWith('<PageHeader') && depth > 0) {
      return true;
    }
  }

  return false;
}

const PAGE_TSX_FILES = walkTsx(PAGES_DIR).map((file) => ({
  relative: toRelative(file),
  source: stripComments(readFileSync(file, 'utf8')),
}));

describe('layout structural guardrails', () => {
  it('never nests <PageHeader> inside <PageBody> in any page', () => {
    const offenders = PAGE_TSX_FILES.filter(({ source }) =>
      hasPageHeaderInsidePageBody(source),
    ).map(({ relative }) => relative);

    expect(offenders).toEqual([]);
  });

  it('never combines Tailwind .container with max-w-[76rem] in Navbar.tsx', () => {
    const navbarSource = stripComments(
      readFileSync(path.join(JS_DIR, 'Components/Navbar.tsx'), 'utf8'),
    );
    const offenders = navbarSource
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /\bcontainer\b/.test(line) && line.includes('max-w-[76rem]'))
      .map(({ number, line }) => `Components/Navbar.tsx:${number}: ${line.trim()}`);

    expect(offenders).toEqual([]);
  });
});
