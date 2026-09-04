import { moveDirectoryId } from '@/components/directory';
import type { AdminOfficialEntity } from '@/lib/api/directories/admin';

import {
  ALL_OFFICIAL_CATEGORIES,
  filterAdminOfficialEntities,
  officialCategoryOptions,
  officialEntityOrders,
} from './model';

function entity(
  overrides: Partial<AdminOfficialEntity> & Pick<AdminOfficialEntity, 'id'>,
): AdminOfficialEntity {
  return {
    category_id: 'ministries',
    description: null,
    description_ar: null,
    image: null,
    is_active: true,
    name: 'Ministry of Health',
    name_ar: 'وزارة الصحة',
    order_column: 1,
    socials: {},
    ...overrides,
  };
}

const entities = [
  entity({ id: 'a1', category_id: 'A', name: 'Presidency', name_ar: 'الرئاسة' }),
  entity({ id: 'a2', category_id: 'A', name: 'Cabinet', name_ar: 'مجلس الوزراء' }),
  entity({ id: 'b1', category_id: 'B', name: 'Health', name_ar: 'وزارة الصحة' }),
  entity({ id: 'b2', category_id: 'B', name: 'Education', name_ar: 'وزارة التربية' }),
];

describe('official account admin list', () => {
  test('searches Arabic names, English names, and identifiers', () => {
    const search = (term: string) =>
      filterAdminOfficialEntities(entities, {
        categoryId: ALL_OFFICIAL_CATEGORIES,
        search: term,
      }).map((item) => item.id);

    expect(search('الرئاسة')).toEqual(['a1']);
    expect(search('EDUCATION')).toEqual(['b2']);
    expect(search('b1')).toEqual(['b1']);
    expect(search('  ')).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  test('filters by category and combines the category with the search term', () => {
    expect(
      filterAdminOfficialEntities(entities, {
        categoryId: 'B',
        search: '',
      }).map((item) => item.id),
    ).toEqual(['b1', 'b2']);
    expect(
      filterAdminOfficialEntities(entities, {
        categoryId: 'A',
        search: 'وزارة',
      }),
    ).toEqual([]);
  });

  test('counts every category plus a total for the all option', () => {
    expect(
      officialCategoryOptions(
        [
          { icon: null, id: 'A', is_active: true, label_ar: 'سيادية', label_en: 'Sovereign', order_column: 1 },
          { icon: null, id: 'C', is_active: true, label_ar: 'فارغة', label_en: 'Empty', order_column: 2 },
        ],
        entities,
      ),
    ).toEqual([
      { label: 'الكل (4)', value: ALL_OFFICIAL_CATEGORIES },
      { label: 'سيادية (2)', value: 'A' },
      { label: 'فارغة (0)', value: 'C' },
    ]);
  });

  test('moving the second entity of a category up never touches another category', () => {
    const orders = officialEntityOrders(entities);
    const target = orders.get('b2');
    expect(target).toEqual({ index: 1, siblings: ['b1', 'b2'] });
    expect(moveDirectoryId(target?.siblings ?? [], target?.index ?? 0, -1)).toEqual([
      'b2',
      'b1',
    ]);
    expect(orders.get('a1')).toEqual({ index: 0, siblings: ['a1', 'a2'] });
  });

  test('marks the first and last entity of each category, not of the flat list', () => {
    const orders = officialEntityOrders(entities);
    expect(orders.get('b1')?.index).toBe(0);
    expect(orders.get('a2')?.index).toBe(1);
    expect(orders.get('a2')?.siblings).toHaveLength(2);
  });
});
