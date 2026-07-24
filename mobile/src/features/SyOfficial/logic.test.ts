import {
  getOfficialCategoryLabel,
  getOfficialImageUrl,
  groupOfficialEntities,
  normalizeOfficialCategories,
} from './logic';
import type { OfficialCategory, OfficialEntity } from './types';

const categories: readonly OfficialCategory[] = [
  {
    icon: null,
    id: 'agencies',
    is_active: true,
    label_ar: 'الهيئات',
    label_en: 'Agencies',
    order_column: 1,
  },
  {
    icon: null,
    id: 'ministries',
    is_active: true,
    label_ar: 'الوزارات',
    label_en: 'Ministries',
    order_column: 2,
  },
];

const entities: readonly OfficialEntity[] = [
  {
    category: 'agencies',
    description: '',
    description_ar: '',
    id: 'second',
    image: 'https://media.example.com/second.webp',
    name: 'Second',
    name_ar: 'الثاني',
    socials: {},
  },
  {
    category: 'ministries',
    description: '',
    description_ar: '',
    id: 'first',
    image: '/storage/first.webp',
    name: 'First',
    name_ar: 'الأول',
    socials: {},
  },
];

test('uses active database categories in their server order', () => {
  expect(normalizeOfficialCategories(categories)).toEqual([
    { key: 'all', label: { ar: 'الكل', en: 'All' } },
    { key: 'agencies', label: { ar: 'الهيئات', en: 'Agencies' } },
    { key: 'ministries', label: { ar: 'الوزارات', en: 'Ministries' } },
  ]);
  expect(getOfficialCategoryLabel('agencies', 'en', categories)).toBe(
    'Agencies',
  );
});

test('groups entities by dynamic category while preserving database order', () => {
  expect(groupOfficialEntities(entities, 'all', categories)).toEqual([
    ['agencies', [entities[0]]],
    ['ministries', [entities[1]]],
  ]);
});

test('resolves R2 URLs and first-party storage paths without legacy prefixes', () => {
  expect(getOfficialImageUrl('https://media.example.com/entity.webp')).toBe(
    'https://media.example.com/entity.webp',
  );
  expect(getOfficialImageUrl('/storage/entity.webp')).toBe(
    'https://syrian.zone/storage/entity.webp',
  );
  expect(getOfficialImageUrl('images/governorates/entity.webp')).toBe(
    'https://syrian.zone/syofficial-assets/images/governorates/entity.webp',
  );
});
