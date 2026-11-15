import { expect, test } from 'bun:test';
import { decodeOfficialPage, filterOfficials } from './model';
const source = { categories: [{ id: 'ministry', label_ar: 'وزارات', label_en: 'Ministries' }], initialData: [{ id: 'health', name: 'Health', name_ar: 'وزارة الصحة', description: '', description_ar: 'الرعاية', image: '/logo.png', category: 'ministry', socials: { website: 'https://example.test/', telegram_secondary: 'https://t.me/example' } }] };
test('preserves official category identity and keyed secondary social links', () => {
  const page = decodeOfficialPage(source);
  expect(page.items[0]?.socials.telegram_secondary).toBe('https://t.me/example');
  expect(page.items[0]?.image).toBe('https://syrian.zone/logo.png');
  expect(filterOfficials(page.items, 'الصحـه', 'ministry')).toHaveLength(1);
  expect(filterOfficials(page.items, 'Health', 'other')).toHaveLength(0);
  expect(filterOfficials(page.items, '  الصحـه  ', 'ministry')).toHaveLength(1);
});
test('rejects a positional social list instead of losing platform names', () => {
  expect(() => decodeOfficialPage({ ...source, initialData: [{ ...source.initialData[0], socials: ['https://example.test'] }] })).toThrow();
});
