import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { rankBackground, shawarmaTiers } from './model';

test('preserves every original restaurant, tier, logo and social URL in source order', () => {
  const source = readFileSync(new URL('../../../../resources/js/Pages/Shawarma/Index.tsx', import.meta.url), 'utf8');
  const original = [...source.matchAll(/rank: '([SABC])',[\s\S]*?spots: \[([\s\S]*?)\]/g)].map(match => ({
    rank: match[1], spots: [...match[2]!.matchAll(/name: '([^']+)', logo: '([^']+)', href: '([^']+)', social: '(instagram|facebook)'/g)].map(spot => ({ name: spot[1], logo: spot[2], href: spot[3], social: spot[4] }))
  }));
  expect(original.map(tier => tier.spots.length)).toEqual([4, 2, 3, 1]);
  expect(original).toEqual(shawarmaTiers.map(({ rank, spots }) => ({ rank, spots: [...spots] })));
});

test('every bundled logo is the original WebP and every account uses HTTPS', () => {
  const paths = new Set<string>();
  for (const tier of shawarmaTiers) for (const spot of tier.spots) {
    expect(paths.has(spot.logo)).toBe(false); paths.add(spot.logo);
    const bytes = readFileSync(new URL(`../../../../public${spot.logo}`, import.meta.url));
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
    const url = new URL(spot.href);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe(spot.social === 'instagram' ? 'www.instagram.com' : 'www.facebook.com');
  }
  expect(paths.size).toBe(10);
});

test('Metro includes every original logo through a static unchanged source path', () => {
  const source = readFileSync(new URL('./logos.ts', import.meta.url), 'utf8');
  const manifest = [...source.matchAll(/'([^']+)': require\('([^']+)'\)/g)];
  const expected = shawarmaTiers.flatMap(tier => tier.spots.map(spot => spot.logo)).sort();
  expect(manifest.map(match => match[1]).sort()).toEqual(expected);
  for (const match of manifest) {
    expect(new URL(match[2]!, import.meta.url).href).toBe(new URL(`../../../../public${match[1]}`, import.meta.url).href);
  }
});

test('the original rank colors remain readable against their native background in both themes', () => {
  const luminance = (hex: string): number => {
    const channels = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
  };
  for (const tier of shawarmaTiers) {
    const colors = [luminance(tier.color), luminance(rankBackground)].sort((a, b) => b - a);
    expect((colors[0]! + 0.05) / (colors[1]! + 0.05)).toBeGreaterThanOrEqual(4.5);
  }
});
