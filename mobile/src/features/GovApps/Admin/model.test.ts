import type { AdminGovernmentApp } from '@/lib/api/directories/admin';

import { filterGovernmentApps } from './model';

function app(
  overrides: Partial<AdminGovernmentApp> & Pick<AdminGovernmentApp, 'id'>,
): AdminGovernmentApp {
  return {
    description: null,
    description_ar: null,
    icon: null,
    images: [],
    is_active: true,
    links: {},
    name: 'Tax Portal',
    name_ar: 'بوابة الضرائب',
    order_column: 1,
    ...overrides,
  };
}

const apps = [
  app({ id: 'tax' }),
  app({ id: 'health-app', name: 'Health', name_ar: 'وزارة الصحة' }),
];

describe('government app admin list', () => {
  test('searches Arabic names, English names, and identifiers', () => {
    const search = (term: string) =>
      filterGovernmentApps(apps, term).map((item) => item.id);

    expect(search('الصحة')).toEqual(['health-app']);
    expect(search('TAX')).toEqual(['tax']);
    expect(search('health-')).toEqual(['health-app']);
  });

  test('returns every app for an empty or blank search', () => {
    expect(filterGovernmentApps(apps, '')).toHaveLength(2);
    expect(filterGovernmentApps(apps, '   ')).toHaveLength(2);
  });
});
