import { resolveDirectoryImageUrl } from '@/lib/api/directories';

import type { OfficialEntity } from './types';

export type OfficialLanguage = 'ar' | 'en' | 'ku' | 'tr';
export type OfficialSort = 'category' | 'name-asc' | 'name-desc';

export const OFFICIAL_CATEGORIES = [
  { key: 'all', label: { ar: 'الكل', en: 'All' } },
  { key: 'governorates', label: { ar: 'المحافظات', en: 'Governorates' } },
  { key: 'ministries', label: { ar: 'الوزارات', en: 'Ministries' } },
  { key: 'ministers', label: { ar: 'الوزراء', en: 'Ministers' } },
  {
    key: 'public_figures',
    label: { ar: 'الشخصيات العامة', en: 'Public Figures' },
  },
  { key: 'syndicates', label: { ar: 'النقابات', en: 'Syndicates' } },
  { key: 'universities', label: { ar: 'الجامعات', en: 'Universities' } },
  { key: 'embassies', label: { ar: 'السفارات', en: 'Embassies' } },
  { key: 'other', label: { ar: 'أخرى', en: 'Other' } },
] as const;

export function isOfficialRtl(language: OfficialLanguage): boolean {
  return language === 'ar' || language === 'ku';
}

export function getOfficialName(
  item: OfficialEntity,
  language: OfficialLanguage,
): string {
  return language === 'ar' ? item.name_ar : item.name;
}

export function getOfficialDescription(
  item: OfficialEntity,
  language: OfficialLanguage,
): string {
  return language === 'ar'
    ? item.description_ar || item.description
    : item.description;
}

export function getOfficialCategoryLabel(
  key: string,
  language: OfficialLanguage,
): string {
  const category = OFFICIAL_CATEGORIES.find((entry) => entry.key === key);
  if (!category) {
    return key;
  }
  return language === 'ar' ? category.label.ar : category.label.en;
}

interface OfficialFilterOptions {
  category: string;
  language: OfficialLanguage;
  search: string;
  sort: OfficialSort;
}

export function filterAndSortOfficialEntities(
  items: readonly OfficialEntity[],
  { category, language, search, sort }: OfficialFilterOptions,
): OfficialEntity[] {
  const term = search.toLowerCase();
  const filtered = items.filter((item) => {
    const categoryMatches = category === 'all' || item.category === category;
    const searchMatches =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.name_ar.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.description_ar.toLowerCase().includes(term);
    return categoryMatches && searchMatches;
  });

  return filtered.sort((first, second) => {
    if (sort === 'category') {
      return first.category.localeCompare(second.category);
    }

    const firstName = getOfficialName(first, language);
    const secondName = getOfficialName(second, language);
    const locale = language === 'ar' ? 'ar' : 'en';
    return sort === 'name-asc'
      ? firstName.localeCompare(secondName, locale)
      : secondName.localeCompare(firstName, locale);
  });
}

export function groupOfficialEntities(
  items: readonly OfficialEntity[],
  category: string,
): readonly (readonly [string, OfficialEntity[]])[] {
  if (category !== 'all') {
    return [[category, [...items]]];
  }

  const groups = new Map<string, OfficialEntity[]>();
  for (const entry of OFFICIAL_CATEGORIES) {
    if (entry.key !== 'all') {
      groups.set(entry.key, []);
    }
  }

  for (const item of items) {
    const key = groups.has(item.category) ? item.category : 'other';
    groups.get(key)?.push(item);
  }

  return [...groups.entries()].filter(([, values]) => values.length > 0);
}

export function getOfficialImageUrl(image: string): string | null {
  const normalized = image.replace(/^\/+/, '');
  if (!normalized) {
    return null;
  }
  const path = normalized.startsWith('syofficial-assets/')
    ? `/${normalized}`
    : `/syofficial-assets/${normalized}`;
  return resolveDirectoryImageUrl(path);
}
