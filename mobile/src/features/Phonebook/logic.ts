import type { DirectoryPhonebookEntry } from '@/lib/api/directories';

export type PhonebookEntry = DirectoryPhonebookEntry;

export interface PhonebookCategory {
  key: string;
  labelAr: string;
  labelEn: string;
}

export function getPhonebookCategoryKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '_');
}

export function getPhonebookCategories(
  items: readonly PhonebookEntry[],
): PhonebookCategory[] {
  const categories = new Map<string, string>();
  for (const item of items) {
    if (item.category_en) {
      categories.set(item.category_en, item.category_ar);
    }
  }

  return [
    { key: 'all', labelAr: 'الكل', labelEn: 'All' },
    ...[...categories.entries()].map(([labelEn, labelAr]) => ({
      key: getPhonebookCategoryKey(labelEn),
      labelAr,
      labelEn,
    })),
  ];
}

export function normalizePhonebookSearchNumber(value: string): string {
  return value.replace(/[\s\-()+]/g, '');
}

export function filterPhonebookEntries(
  items: readonly PhonebookEntry[],
  category: string,
  search: string,
): PhonebookEntry[] {
  const term = search.toLowerCase();
  const normalizedTerm = normalizePhonebookSearchNumber(term);
  return items
    .filter((item) => {
      const categoryMatches =
        category === 'all' ||
        getPhonebookCategoryKey(item.category_en) === category;
      const searchMatches =
        !term ||
        item.name_ar.toLowerCase().includes(term) ||
        item.name_en.toLowerCase().includes(term) ||
        item.category_ar.toLowerCase().includes(term) ||
        item.category_en.toLowerCase().includes(term) ||
        normalizePhonebookSearchNumber(item.number).includes(normalizedTerm);
      return categoryMatches && searchMatches;
    })
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((first, second) => {
      const firstNumber = normalizePhonebookSearchNumber(first.item.number);
      const secondNumber = normalizePhonebookSearchNumber(second.item.number);
      const firstIsShort = /^\d{3}$/.test(firstNumber);
      const secondIsShort = /^\d{3}$/.test(secondNumber);
      if (firstIsShort !== secondIsShort) {
        return firstIsShort ? -1 : 1;
      }
      return first.sourceIndex - second.sourceIndex;
    })
    .map(({ item }) => item);
}

export function getTelephoneUrl(number: string): string {
  return `tel:${number.replace(/[\s\-()]/g, '')}`;
}

export function getWhatsAppUrl(number: string): string {
  let cleaned = number.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = `963${cleaned.slice(1)}`;
  }
  return `https://wa.me/${cleaned}`;
}
