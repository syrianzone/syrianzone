import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  expandGlyphRanges,
  glyphPayloadSha256,
  glyphRanges,
  glyphStacks,
} from './map-glyph-contract.mjs';

const expectedRanges = Array.from({ length: 256 }, (_, block) => {
  const start = block * 256;
  return [start, start + 255];
});
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('declares every BMP glyph range in 256-codepoint blocks', () => {
  assert.deepEqual(glyphRanges, expectedRanges);
  assert.equal(glyphRanges.length, 256);
  for (const [start, end] of glyphRanges) {
    assert.equal(start % 256, 0);
    assert.equal(end - start, 255);
  }
});

test('generates 256-511 for both IBM Plex Arabic map stacks', () => {
  assert.deepEqual(
    glyphStacks.map(({ name }) => name),
    [
      'IBM Plex Sans Arabic Regular',
      'IBM Plex Sans Arabic Bold',
    ],
  );
  for (const stack of glyphStacks) {
    const outputs = glyphRanges.map(
      ([start, end]) => `${stack.name}/${start}-${end}.pbf`,
    );
    assert.ok(outputs.includes(`${stack.name}/256-511.pbf`));
  }
});

test('commits every expected BMP PBF output for both map stacks', () => {
  for (const stack of glyphStacks) {
    for (const [start, end] of expectedRanges) {
      const output = join(
        root,
        'public/fonts/map',
        stack.name,
        `${start}-${end}.pbf`,
      );
      assert.ok(statSync(output).size > 0, `${output} must not be empty`);
    }
  }
});

test('locks the complete glyph payload to its deterministic digest', () => {
  const payloads = glyphStacks
    .flatMap((stack) =>
      expectedRanges.map(([start, end]) => ({
        absolute: join(
          root,
          'public/fonts/map',
          stack.name,
          `${start}-${end}.pbf`,
        ),
        relative: `${stack.name}/${start}-${end}.pbf`,
      })),
    )
    .sort((left, right) => left.relative.localeCompare(right.relative));
  const digest = createHash('sha256');

  for (const payload of payloads) {
    digest.update(payload.relative);
    digest.update('\0');
    digest.update(readFileSync(payload.absolute));
  }

  assert.equal(digest.digest('hex'), glyphPayloadSha256);
});

test('generates every font stack consumed by server and bundled styles', () => {
  const generatedStacks = glyphStacks.map(({ name }) => name).sort();
  const styles = [
    'public/styles/styles/dark-matter-vector.json',
    'public/styles/styles/light-vector.json',
    'mobile/assets/styles/dark-matter-vector.json',
    'mobile/assets/styles/light-vector.json',
  ];

  for (const relativePath of styles) {
    const style = JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
    const consumedStacks = [
      ...new Set(
        style.layers.flatMap((layer) => layer.layout?.['text-font'] ?? []),
      ),
    ].sort();
    assert.deepEqual(
      consumedStacks,
      generatedStacks,
      `${relativePath} must use only generated font stacks`,
    );
  }
});

test('normalizes overlapping coverage and rejects unbounded input', () => {
  assert.deepEqual(
    expandGlyphRanges([
      [260, 300],
      [0, 511],
    ]),
    [
      [0, 255],
      [256, 511],
    ],
  );
  assert.throws(
    () => expandGlyphRanges([[0, Number.POSITIVE_INFINITY]]),
    /finite safe integers/,
  );
});
