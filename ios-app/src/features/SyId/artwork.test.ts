import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { artwork, artworkSources } from '../../ui/original-artwork.generated';
import { originalProvinces, provinceSource } from './provinces.generated';
import { decodeProvinces } from './model';
import { resolveSvgCss } from './svg';
const root = resolve(import.meta.dir, '../../../..');
test('all nineteen native artworks match original geometry and have no unresolved stylesheet', () => {
  expect(Object.keys(artworkSources)).toHaveLength(19);
  for (const [key, source] of Object.entries(artworkSources)) {
    const original = readFileSync(resolve(root, source.path), 'utf8');
    expect(createHash('sha256').update(original).digest('hex')).toBe(source.sha256);
    expect(artwork[key]).toBe(resolveSvgCss(original));
    expect(artwork[key]).not.toMatch(/<style|\bclass=|\bstyle=/);
    expect(artwork[key]?.match(/\sd="[^"]*"/g)).toEqual(original.match(/\sd="[^"]*"/g));
  }
});
test('bundled native map retains all fourteen real provinces and both interior rings', () => {
  const original = readFileSync(resolve(root, provinceSource.path), 'utf8');
  expect(createHash('sha256').update(original).digest('hex')).toBe(provinceSource.sha256);
  expect(originalProvinces()).toEqual(JSON.parse(original));
  const provinces = decodeProvinces(originalProvinces());
  expect(provinces).toHaveLength(14);
  expect(provinces.reduce((count, province) => count + province.holes.length, 0)).toBe(2);
});
