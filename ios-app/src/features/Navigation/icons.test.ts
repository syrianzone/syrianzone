import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import icons from './icons.json';
test('all source navigation icon choices are preserved in order', () => {
  const source =
    readFileSync(new URL('../../../../resources/js/Lib/siteLinks.ts', import.meta.url), 'utf8')
      .split('export const SITE_ICON_OPTIONS:')[1]
      ?.split('];')[0] ?? '';
  const expected = Array.from(source.matchAll(/\{ key: '([^']+)', label: '([^']+)' \}/g), (match) => ({
    key: match[1] ?? '',
    label: match[2] ?? '',
  }));
  expect(icons).toEqual(expected);
  expect(icons).toHaveLength(35);
});
