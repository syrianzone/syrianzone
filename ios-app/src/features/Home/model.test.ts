import { expect, test } from 'bun:test';
import modules from '../../../../resources/data/site-modules.json';
import { bundledCatalogue, decodeHomePreferences, decodeNavigation, matchesSearch, decodeSearch, gameSearchResults, linkDraft } from './model';

test('preserves catalogue grouping independently of whether its destination is external', () => {
  const items = decodeNavigation({ items: modules.modules.map(item => ({ ...item, text: item.title, enabled: true, showOnHome: true })) });
  expect(items.find(item => item.id === 'recipes')?.isInternal).toBe(true);
  expect(items.find(item => item.id === 'joory')?.isInternal).toBe(false);
  expect(decodeNavigation({ items: [{ ...modules.modules[0], enabled: false, showOnHome: true }] })).toEqual([]);
});
test('bundled navigation keeps offline tools reachable before a network request finishes', () => {
  expect(bundledCatalogue.some(item => item.id === 'games' && !item.external)).toBe(true);
  expect(bundledCatalogue.some(item => item.id === 'muslim' && !item.external)).toBe(true);
  expect(bundledCatalogue.some(item => item.id === 'joory' && item.external)).toBe(true);
  expect(new Set(bundledCatalogue.map(item => item.id)).size).toBe(bundledCatalogue.length);
});
test('keeps President external in search instead of inventing a native game route', () => {
  expect(gameSearchResults('').find(game => game.id === 'president')?.url).toBe('https://game.hadealahmad.com/');
});
test('keeps account link aliases and icon while validating stored URLs', () => {
  const value = decodeHomePreferences({ customLinks: [{ id: '1', title: 'قديم', url: 'https://example.com', icon: '🌍' }], showWeather: false });
  expect(value.customLinks[0]).toMatchObject({ name: 'قديم', icon: '🌍' });
  expect(value.showWeather).toBe(false);
  expect(value.showEvents).toBe(true);
  expect(() => linkDraft('x', 'x', 'javascript:alert(1)', '')).toThrow();
});
test('matches Arabic diacritics and all search tokens without changing remote resource identities', () => {
  expect(matchesSearch('دمشق باص', 'باص دِمشق')).toBe(true);
  expect(matchesSearch('دمشق باص', 'دمشق')).toBe(false);
  const result = decodeSearch({ routes: [{ id: 'route-damascus-123', cityId: 'damascus', nameAr: 'المزة' }], places: [{ id: 17, name: 'حديقة' }], phonebook: [], officials: [], govapps: [] });
  expect(result.routes[0]?.params).toEqual({ cityId: 'damascus', routeId: 'route-damascus-123' });
  expect(result.places[0]?.params).toEqual({ id: '17' });
});
