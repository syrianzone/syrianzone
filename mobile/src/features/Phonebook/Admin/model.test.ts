import { moveDirectoryId } from '@/components/directory';
import type { AdminPhonebookEntry } from '@/lib/api/directories/admin';

import {
  ALL_PHONEBOOK_CATEGORIES,
  filterAdminPhonebookEntries,
  phonebookCategoryOptions,
  phonebookEntryOrders,
} from './model';

function entry(
  overrides: Partial<AdminPhonebookEntry> & Pick<AdminPhonebookEntry, 'id'>,
): AdminPhonebookEntry {
  return {
    category_id: 'emergency',
    is_active: true,
    is_whatsapp: false,
    name_ar: 'الإسعاف',
    name_en: 'Ambulance',
    number: '110',
    order_column: 1,
    source_url: null,
    ...overrides,
  };
}

const entries = [
  entry({ id: 'a1', category_id: 'A', name_ar: 'الإطفاء', name_en: 'Fire', number: '113' }),
  entry({ id: 'a2', category_id: 'A', name_ar: 'الشرطة', name_en: 'Police', number: '112' }),
  entry({ id: 'b1', category_id: 'B', name_ar: 'الكهرباء', name_en: 'Power', number: '134' }),
  entry({ id: 'b2', category_id: 'B', name_ar: 'المياه', name_en: 'Water', number: '135' }),
];

describe('phonebook admin list', () => {
  test('searches Arabic names, English names, and numbers', () => {
    const search = (term: string) =>
      filterAdminPhonebookEntries(entries, {
        categoryId: ALL_PHONEBOOK_CATEGORIES,
        search: term,
      }).map((item) => item.id);

    expect(search('الشرطة')).toEqual(['a2']);
    expect(search('POWER')).toEqual(['b1']);
    expect(search('135')).toEqual(['b2']);
  });

  test('filters by category and combines the category with the search term', () => {
    expect(
      filterAdminPhonebookEntries(entries, {
        categoryId: 'A',
        search: '',
      }).map((item) => item.id),
    ).toEqual(['a1', 'a2']);
    expect(
      filterAdminPhonebookEntries(entries, { categoryId: 'A', search: 'المياه' }),
    ).toEqual([]);
  });

  test('counts every category plus a total for the all option', () => {
    expect(
      phonebookCategoryOptions(
        [
          { icon: null, id: 'A', is_active: true, label_ar: 'طوارئ', label_en: 'Emergency', order_column: 1 },
          { icon: null, id: 'C', is_active: true, label_ar: 'فارغة', label_en: 'Empty', order_column: 2 },
        ],
        entries,
      ),
    ).toEqual([
      { label: 'الكل (4)', value: ALL_PHONEBOOK_CATEGORIES },
      { label: 'طوارئ (2)', value: 'A' },
      { label: 'فارغة (0)', value: 'C' },
    ]);
  });

  test('moving the second entry of a category up never touches another category', () => {
    const orders = phonebookEntryOrders(entries);
    const target = orders.get('b2');
    expect(target).toEqual({ index: 1, siblings: ['b1', 'b2'] });
    expect(moveDirectoryId(target?.siblings ?? [], target?.index ?? 0, -1)).toEqual([
      'b2',
      'b1',
    ]);
    expect(orders.get('a1')).toEqual({ index: 0, siblings: ['a1', 'a2'] });
  });
});
