import { fetchWebsites as fetchDirectoryWebsites } from '@/lib/api/directories';

import type { Website } from './types';

export const SITES_PAGE_SIZE = 24;
export type SiteSort = 'name' | 'name-desc' | 'type';

export async function fetchWebsites(signal?: AbortSignal): Promise<Website[]> {
  return fetchDirectoryWebsites({ signal });
}

export function getWebsiteTypeDisplayName(type: string): string {
  if (type.includes('مدونة شخصية')) {
    return 'المدونات الشخصية';
  }
  if (type.includes('شركة') || type.includes('مبادرة')) {
    return 'المواقع التعريفية';
  }
  if (type.includes('مجلة') || type.includes('إخباري')) {
    return 'المدونات والمواقع الإخبارية';
  }
  return type;
}

export function getWebsiteCategories(
  websites: readonly Website[],
): string[] {
  return [...new Set(websites.map((website) => website.type).filter(Boolean))]
    .sort();
}

interface WebsiteFilterOptions {
  search: string;
  sort: SiteSort;
  type: string;
}

export function filterAndSortWebsites(
  websites: readonly Website[],
  { search, sort, type }: WebsiteFilterOptions,
): Website[] {
  const term = search.toLowerCase();
  return websites
    .filter((website) => {
      const searchMatches =
        !term ||
        website.name.toLowerCase().includes(term) ||
        website.description.toLowerCase().includes(term) ||
        website.url.toLowerCase().includes(term);
      const typeMatches = !type || website.type === type;
      return searchMatches && typeMatches;
    })
    .sort((first, second) => {
      if (sort === 'name-desc') {
        return second.name.localeCompare(first.name, 'ar');
      }
      if (sort === 'type') {
        return first.type.localeCompare(second.type, 'ar');
      }
      return first.name.localeCompare(second.name, 'ar');
    });
}

/*
PORT STATUS
  source:     resources/js/Pages/Sites/data.ts (81 lines)
  confidence: high
  todos:      0
  notes:      CSV parsing moved server-side and visible directory logic remains native.
*/
