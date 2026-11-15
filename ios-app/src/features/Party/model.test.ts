import { expect, test } from 'bun:test';
import { decodePartyPage, filterOrganizations } from './model';

test('party keeps source organization links and language, filters text plus facets', () => {
  const data = decodePartyPage({ initialOrganizations: [{ id: 'one', name: 'أَمل سوريا', description: 'تجمع مدني', country: 'سوريا', type: 'حزب', lang: 'AR', socialX: '@amal', manifesto: 'https://example.com/manifesto', politicalLeanings: ['ليبرالي'] }, { id: 'two', name: 'جهة ثانية', country: 'لبنان' }], fetchedAt: null });
  expect(filterOrganizations(data.items, 'امل', {})).toHaveLength(1);
  expect(filterOrganizations(data.items, '', { country: 'سوريا', category: 'حزب', lang: 'AR' })).toHaveLength(1);
  expect(filterOrganizations(data.items, 'امل', { country: 'لبنان' })).toHaveLength(0);
  expect(data.items[0]?.manifesto).toBe('https://example.com/manifesto');
  expect(data.items[0]?.politicalLeanings).toEqual(['ليبرالي']);
});
test('party rejects malformed page entries instead of producing blank or duplicate identities', () => {
  expect(() => decodePartyPage({ initialOrganizations: [{ name: 'اسم' }] })).toThrow();
  expect(() => decodePartyPage({ initialOrganizations: [{ id: 'a', name: '' }] })).toThrow();
  expect(() => decodePartyPage({ initialOrganizations: [{ id: 'a', name: 'اسم' }, { id: 'a', name: 'آخر' }] })).toThrow();
  expect(() => decodePartyPage({ initialOrganizations: [{ id: 'a', name: 'اسم', politicalLeanings: [3] }] })).toThrow();
});
