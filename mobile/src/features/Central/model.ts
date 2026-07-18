import { isSafeExternalUrl } from '@/lib/linking';

export type CentralCategory =
  | 'all'
  | 'entities'
  | 'governorates'
  | 'ministries';

export interface CentralLink {
  label: string;
  type: 'app' | 'facebook' | 'other' | 'phone' | 'telegram' | 'website' | 'x';
  value: string;
}

export interface CentralGovernorate {
  id: string;
  links: CentralLink[];
  nameAr: string;
  nameEn: string;
}

export interface CentralOffice {
  head: string;
  id: string;
  image: string;
  links: CentralLink[];
  name: string;
}

export interface CentralDirectoryData {
  governorates: CentralGovernorate[];
  presidency: {
    entities: CentralOffice[];
    ministries: CentralOffice[];
  };
}

export interface CentralDirectoryItem {
  category: Exclude<CentralCategory, 'all'>;
  head: string | null;
  id: string;
  image: string;
  links: CentralLink[];
  name: string;
  subtitle: string;
}

export function centralDirectoryItems(
  data: CentralDirectoryData,
): CentralDirectoryItem[] {
  const governorates = data.governorates.map((governorate) => ({
    category: 'governorates' as const,
    head: null,
    id: governorate.id,
    image: '',
    links: governorate.links,
    name: governorate.nameAr,
    subtitle: governorate.nameEn,
  }));
  const offices = (
    [
      ['entities', data.presidency.entities],
      ['ministries', data.presidency.ministries],
    ] as const
  ).flatMap(([category, entries]) =>
    entries.map((entry) => ({
      category,
      head: entry.head,
      id: entry.id,
      image: entry.image,
      links: entry.links,
      name: entry.name,
      subtitle: entry.head,
    })),
  );
  return [...governorates, ...offices];
}

export function filterCentralDirectoryItems(
  items: readonly CentralDirectoryItem[],
  category: CentralCategory,
  search: string,
): CentralDirectoryItem[] {
  const term = search.trim().toLocaleLowerCase('ar');
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    return (
      !term ||
      item.name.toLocaleLowerCase('ar').includes(term) ||
      item.subtitle.toLocaleLowerCase('ar').includes(term)
    );
  });
}

export function centralLinkUrl(link: CentralLink): string | null {
  const value = link.value.trim();
  const candidate = link.type === 'phone'
    ? `tel:${value.replace(/[^+\d]/g, '')}`
    : value;
  return candidate && isSafeExternalUrl(candidate) ? candidate : null;
}

export function centralCategoryLabel(
  category: Exclude<CentralCategory, 'all'>,
): string {
  switch (category) {
    case 'governorates':
      return 'محافظة سورية';
    case 'entities':
      return 'هيئة سيادية';
    case 'ministries':
      return 'حقيبة وزارية';
  }
}

export function centralLinkTypeLabel(type: CentralLink['type']): string {
  switch (type) {
    case 'website':
      return 'الموقع الرسمي';
    case 'facebook':
      return 'فيسبوك';
    case 'telegram':
      return 'تلغرام';
    case 'x':
      return 'منصة إكس';
    case 'app':
      return 'تطبيق ذكي';
    case 'phone':
      return 'هاتف خدمي';
    default:
      return 'معلومة أخرى';
  }
}

/*
PORT STATUS
  source:     resources/js/Pages/Central/Index.tsx (468 lines)
  confidence: high
  todos:      0
  notes:      Static source records use a typed native filter and safe link normalization.
*/
