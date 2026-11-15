import { expect, test } from 'bun:test';
import { decodeGovApps, filterGovApps } from './model';
test('platform filtering uses available link keys and ORs selected platforms', () => {
  const page = decodeGovApps({ initialData: [{ id: 'one', name: 'تطبيق حكومي', description: null, icon: null, images: [], links: { apple: 'https://apps.apple.com/app/id1', android: null, official: '' } }, { id: 'two', name: 'خدمة', description: 'رسمية', icon: null, images: [], links: { official: 'https://example.test/' } }] });
  expect(filterGovApps(page, '', ['apple']).map(a => a.id)).toEqual(['one']);
  expect(filterGovApps(page, '', ['apple', 'official'])).toHaveLength(2);
  expect(filterGovApps(page, 'رسميه', [])).toHaveLength(1);
  expect(filterGovApps(page, '  رسميه  ', [])).toHaveLength(1);
});
test('legacy positional links do not hide the catalogue or receive invented platform labels', () => {
  const page = decodeGovApps({ initialData: [{ id: 'one', name: 'تطبيق', links: ['https://example.test/legacy'], images: [] }] });
  expect(page[0]?.legacyLinks).toEqual(['https://example.test/legacy']);
  expect(page[0]?.links).toEqual({});
  expect(filterGovApps(page, '', [])).toHaveLength(1);
  expect(filterGovApps(page, '', ['apple'])).toHaveLength(0);
});
test('unsafe native image sources remain rejected', () => {
  expect(() => decodeGovApps({ initialData: [{ id: 'one', name: 'x', links: {}, icon: 'file:///private/photo', images: [] }] })).toThrow();
});
