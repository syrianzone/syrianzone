import { resolveDirectoryImageUrl } from '@/lib/api/directories';

import type { OfficialCategory, OfficialEntity } from './types';

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

export interface OfficialCategoryOption {
  key: string;
  label: { ar: string; en: string };
}

export function normalizeOfficialCategories(
  categories: readonly OfficialCategory[],
): readonly OfficialCategoryOption[] {
  if (categories.length === 0) {
    return OFFICIAL_CATEGORIES;
  }

  return [
    { key: 'all', label: { ar: 'الكل', en: 'All' } },
    ...categories
      .filter((category) => category.is_active)
      .sort((first, second) => first.order_column - second.order_column)
      .map((category) => ({
        key: category.id,
        label: { ar: category.label_ar, en: category.label_en },
      })),
  ];
}

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
  categories: readonly OfficialCategory[] = [],
): string {
  const category = normalizeOfficialCategories(categories).find(
    (entry) => entry.key === key,
  );
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
  { category, search }: OfficialFilterOptions,
): OfficialEntity[] {
  const term = search.toLowerCase();
  return items.filter((item) => {
    const categoryMatches = category === 'all' || item.category === category;
    const searchMatches =
      !term ||
      item.name.toLowerCase().includes(term) ||
      item.name_ar.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.description_ar.toLowerCase().includes(term);
    return categoryMatches && searchMatches;
  });
}

export function groupOfficialEntities(
  items: readonly OfficialEntity[],
  category: string,
  categories: readonly OfficialCategory[] = [],
): readonly (readonly [string, OfficialEntity[]])[] {
  if (category !== 'all') {
    return [[category, [...items]]];
  }

  const groups = new Map<string, OfficialEntity[]>();
  for (const entry of normalizeOfficialCategories(categories)) {
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
  const normalized = image.trim();
  if (!normalized) {
    return null;
  }

  if (/^https?:\/\//i.test(normalized)) {
    return resolveDirectoryImageUrl(normalized);
  }

  const path = normalized.replace(/^\/+/, '');
  if (path.startsWith('storage/') || path.startsWith('syofficial-assets/')) {
    return resolveDirectoryImageUrl(`/${path}`);
  }
  return resolveDirectoryImageUrl(`/syofficial-assets/${path}`);
}
