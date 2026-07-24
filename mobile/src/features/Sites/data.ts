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
  type: string;
}

export function filterWebsites(
  websites: readonly Website[],
  { search, type }: WebsiteFilterOptions,
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
    });
}

export function filterAndSortWebsites(
  websites: readonly Website[],
  options: WebsiteFilterOptions & { sort?: SiteSort },
): Website[] {
  return filterWebsites(websites, options);
}

export function getWebsiteFaviconUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
  } catch {
    return null;
  }
}

/*
PORT STATUS
  source:     resources/js/Pages/Sites/data.ts (81 lines)
  confidence: high
  todos:      0
  notes:      CSV parsing moved server-side and visible directory logic remains native.
*/
