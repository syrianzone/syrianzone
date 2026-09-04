import type { DirectoryOption } from '@/components/directory';
import type {
  AdminPhonebookCategory,
  AdminPhonebookEntry,
} from '@/lib/api/directories/admin';

export const ALL_PHONEBOOK_CATEGORIES = 'all';

export interface PhonebookEntryFilter {
  categoryId: string;
  search: string;
}

export interface PhonebookEntryOrder {
  index: number;
  siblings: readonly string[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ar');
}

export function phonebookCategoryOptions(
  categories: readonly AdminPhonebookCategory[],
  entries: readonly AdminPhonebookEntry[],
): DirectoryOption[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.category_id, (counts.get(entry.category_id) ?? 0) + 1);
  }

  return [
    {
      label: `الكل (${entries.length})`,
      value: ALL_PHONEBOOK_CATEGORIES,
    },
    ...categories.map((category) => ({
      label: `${category.label_ar} (${counts.get(category.id) ?? 0})`,
      value: category.id,
    })),
  ];
}

export function filterAdminPhonebookEntries(
  entries: readonly AdminPhonebookEntry[],
  { categoryId, search }: PhonebookEntryFilter,
): AdminPhonebookEntry[] {
  const term = normalize(search);

  return entries.filter((entry) => {
    if (
      categoryId !== ALL_PHONEBOOK_CATEGORIES &&
      entry.category_id !== categoryId
    ) {
      return false;
    }
    if (!term) {
      return true;
    }
    return [entry.name_ar, entry.name_en ?? '', entry.number].some((value) =>
      normalize(value).includes(term),
    );
  });
}

// The public directory groups entries by category and the backend numbers
// order_column per category, so an arrow press has to move an entry inside its
// own category instead of the category-mixed admin list.
export function phonebookEntryOrders(
  entries: readonly AdminPhonebookEntry[],
): Map<string, PhonebookEntryOrder> {
  const byCategory = new Map<string, string[]>();
  for (const entry of entries) {
    const siblings = byCategory.get(entry.category_id) ?? [];
    siblings.push(entry.id);
    byCategory.set(entry.category_id, siblings);
  }

  const orders = new Map<string, PhonebookEntryOrder>();
  for (const siblings of byCategory.values()) {
    siblings.forEach((id, index) => orders.set(id, { index, siblings }));
  }
  return orders;
}
