import {
  filterWebsites,
  getWebsiteFaviconUrl,
  SITES_PAGE_SIZE,
} from './data';
import type { Website } from './types';

const sites: readonly Website[] = [
  {
    description: 'ثان',
    id: 'second',
    name: 'ياء',
    type: 'مبادرة',
    url: 'https://second.example.com',
  },
  {
    description: 'أول',
    id: 'first',
    name: 'ألف',
    type: 'مجلة',
    url: 'https://first.example.com',
  },
];

test('keeps the final source order while filtering sites', () => {
  expect(filterWebsites(sites, { search: '', type: '' }).map(({ id }) => id))
    .toEqual(['second', 'first']);
  expect(
    filterWebsites(sites, { search: 'ألف', type: '' }).map(({ id }) => id),
  ).toEqual(['first']);
  expect(SITES_PAGE_SIZE).toBe(24);
});

test('asks each site for its own favicon instead of a third-party service', () => {
  expect(getWebsiteFaviconUrl('https://second.example.com/page')).toBe(
    'https://second.example.com/favicon.ico',
  );
  expect(getWebsiteFaviconUrl('javascript:alert(1)')).toBeNull();
  expect(getWebsiteFaviconUrl('not-a-url')).toBeNull();
});
