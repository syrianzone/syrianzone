import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ayahArtwork } from './ayah-artwork.generated';

test('preserves confirmed Alkalami geometry and number slot in the native ornament', () => {
  const source = readFileSync(new URL('../../assets/artwork/ayah-001.svg', import.meta.url), 'utf8');
  expect(new Bun.CryptoHasher('sha256').update(source).digest('hex')).toBe('bd060a98d5490d502a4aa23322bfced011b5f854d2964991acaf2a48e661a9cb');
  const paths = (xml: string) => [...xml.matchAll(/\sd="([^"]+)"/g)].map(match => match[1]);
  expect(paths(ayahArtwork.xml)).toEqual(paths(source));
  expect(ayahArtwork.xml).not.toMatch(/<metadata|\sclass=|\sstyle=|currentColor|var\(/);
  expect(ayahArtwork.slot).toMatchObject({ cx: 49.80575, h: 19.1082 });
});
