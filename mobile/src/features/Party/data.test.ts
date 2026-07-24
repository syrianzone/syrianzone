import {
  filterOrganizations,
  PARTY_PAGE_SIZE,
} from './data';
import type { Organization } from './types';

const organizations: readonly Organization[] = [
  {
    country: 'سوريا',
    id: 'second',
    lang: 'AR',
    name: 'ياء',
    type: 'حزب',
  },
  {
    country: 'سوريا',
    id: 'first',
    lang: 'AR',
    name: 'ألف',
    type: 'حزب',
  },
];

test('filters parties without introducing a client-side sort', () => {
  expect(
    filterOrganizations(organizations, {
      category: 'all',
      city: 'all',
      country: 'سوريا',
      language: 'all',
      search: '',
    }).map(({ id }) => id),
  ).toEqual(['second', 'first']);
  expect(PARTY_PAGE_SIZE).toBe(15);
});
