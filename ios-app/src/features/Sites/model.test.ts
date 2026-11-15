import { expect, test } from 'bun:test';
import { decodeSitesPage, filterSites, typeLabel } from './model';
test('keeps source type identity while grouping display labels and filtering Arabic', () => {
  const page = decodeSitesPage({ initialWebsites: [{ id: 'one', name: 'مبادرة سورية', url: 'http://example.test/', type: 'شركة أو مبادرة', description: 'برمجة' }], fetchedAt: null });
  expect(typeLabel(page.items[0]?.type ?? '')).toBe('المواقع التعريفية');
  expect(filterSites(page.items, 'برمجه', 'شركة أو مبادرة')).toHaveLength(1);
  expect(filterSites(page.items, '', 'مدونة شخصية')).toHaveLength(0);
  expect(filterSites(page.items, '  برمجه  ', '')).toHaveLength(1);
  expect(page.items[0]?.url).toBe('http://example.test/');
});
test('rejects executable external URLs and a missing website collection', () => {
  expect(() => decodeSitesPage({ initialWebsites: [{ id: 'one', name: 'x', url: 'javascript:alert(1)', type: '', description: '' }] })).toThrow();
  expect(() => decodeSitesPage({})).toThrow();
});
