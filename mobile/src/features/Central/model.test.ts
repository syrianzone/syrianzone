import type { CentralDirectoryData } from './model';
import {
  centralDirectoryItems,
  centralLinkUrl,
  filterCentralDirectoryItems,
} from './model';

const data: CentralDirectoryData = {
  governorates: [
    {
      id: 'damascus',
      links: [
        { label: 'هاتف المحافظة', type: 'phone', value: '011-1234567' },
      ],
      nameAr: 'دمشق',
      nameEn: 'Damascus',
    },
  ],
  presidency: {
    entities: [
      {
        head: 'مدير الهيئة',
        id: 'inspection',
        image: '',
        links: [
          {
            label: 'الموقع الرسمي',
            type: 'website',
            value: 'https://inspection.example',
          },
        ],
        name: 'هيئة الرقابة',
      },
    ],
    ministries: [
      {
        head: 'وزير النقل',
        id: 'transport',
        image: '',
        links: [],
        name: 'وزارة النقل',
      },
    ],
  },
};

test('unifies governorates, entities, and ministries without losing category identity', () => {
  expect(centralDirectoryItems(data)).toEqual([
    expect.objectContaining({ category: 'governorates', name: 'دمشق' }),
    expect.objectContaining({ category: 'entities', name: 'هيئة الرقابة' }),
    expect.objectContaining({ category: 'ministries', name: 'وزارة النقل' }),
  ]);
});

test('filters the directory by category and responsible person', () => {
  const items = centralDirectoryItems(data);

  expect(filterCentralDirectoryItems(items, 'entities', 'مدير')).toEqual([
    expect.objectContaining({ id: 'inspection' }),
  ]);
  expect(filterCentralDirectoryItems(items, 'ministries', 'مدير')).toEqual([]);
  expect(filterCentralDirectoryItems(items, 'all', 'Damascus')).toEqual([
    expect.objectContaining({ id: 'damascus' }),
  ]);
});

test('normalizes safe directory links and rejects non-link notes', () => {
  expect(centralLinkUrl({ label: '', type: 'phone', value: '011 123-4567' })).toBe(
    'tel:0111234567',
  );
  expect(
    centralLinkUrl({
      label: '',
      type: 'website',
      value: 'https://central.example/path',
    }),
  ).toBe('https://central.example/path');
  expect(
    centralLinkUrl({ label: '', type: 'other', value: 'معلومة إدارية' }),
  ).toBeNull();
  expect(
    centralLinkUrl({ label: '', type: 'website', value: 'javascript:alert(1)' }),
  ).toBeNull();
});
