/**
 * Structural accessibility and RTL guardrails across all React TSX files.
 *
 * Keeps high-signal regressions from slipping past typecheck/ESLint:
 *  - Every Radix DialogContent has both DialogTitle and DialogDescription.
 *  - Every Radix SheetContent has both SheetTitle and SheetDescription.
 *  - Zero physical RTL spacing utilities (ml/mr/pl/pr) outside deliberate dir="ltr" islands.
 *  - Zero clickable <Badge onClick> controls (use <FilterChip> or <Button>).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const JS_DIR = path.dirname(fileURLToPath(import.meta.url));

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

const TSX_FILES = walkTsx(JS_DIR).map((file) => ({
  relative: toRelative(file),
  source: stripComments(readFileSync(file, 'utf8')),
}));

describe('a11y and RTL structural guardrails', () => {
  it('every file rendering <DialogContent also renders DialogTitle and DialogDescription', () => {
    const offenders = TSX_FILES.filter(
      ({ source }) =>
        /<DialogContent\b/.test(source) &&
        (!source.includes('DialogTitle') || !source.includes('DialogDescription')),
    ).map(({ relative }) => relative);

    expect(offenders).toEqual([]);
  });

  it('every file rendering <SheetContent also renders SheetTitle and SheetDescription', () => {
    const offenders = TSX_FILES.filter(
      ({ source }) =>
        /<SheetContent\b/.test(source) &&
        (!source.includes('SheetTitle') || !source.includes('SheetDescription')),
    ).map(({ relative }) => relative);

    expect(offenders).toEqual([]);
  });

  it('uses logical RTL spacing utilities instead of physical ml/mr/pl/pr', () => {
    const physicalSpacing = /\b(?:ml|mr|pl|pr)-[0-9a-z\[]/;
    const offenders: string[] = [];

    for (const { relative, source } of TSX_FILES) {
      const lines = source.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!physicalSpacing.test(line)) continue;
        // Allow deliberate dir="ltr" islands on the same line or immediate wrapper.
        const context = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        if (/dir=["']ltr["']/.test(context)) continue;
        offenders.push(`${relative}:${i + 1}: ${line.trim()}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('never attaches onClick to <Badge> (use FilterChip or Button instead)', () => {
    const offenders = TSX_FILES.filter(({ source }) =>
      /<Badge\b[^>]*\bonClick\b/.test(source),
    ).map(({ relative }) => relative);

    expect(offenders).toEqual([]);
  });
});
