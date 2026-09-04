import type { DirectoryOption } from '@/components/directory';
import type {
  AdminOfficialCategory,
  AdminOfficialEntity,
} from '@/lib/api/directories/admin';

export const ALL_OFFICIAL_CATEGORIES = 'all';

export interface OfficialEntityFilter {
  categoryId: string;
  search: string;
}

export interface OfficialEntityOrder {
  index: number;
  siblings: readonly string[];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('ar');
}

export function officialCategoryOptions(
  categories: readonly AdminOfficialCategory[],
  entities: readonly AdminOfficialEntity[],
): DirectoryOption[] {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    counts.set(entity.category_id, (counts.get(entity.category_id) ?? 0) + 1);
  }

  return [
    {
      label: `الكل (${entities.length})`,
      value: ALL_OFFICIAL_CATEGORIES,
    },
    ...categories.map((category) => ({
      label: `${category.label_ar} (${counts.get(category.id) ?? 0})`,
      value: category.id,
    })),
  ];
}

export function filterAdminOfficialEntities(
  entities: readonly AdminOfficialEntity[],
  { categoryId, search }: OfficialEntityFilter,
): AdminOfficialEntity[] {
  const term = normalize(search);

  return entities.filter((entity) => {
    if (
      categoryId !== ALL_OFFICIAL_CATEGORIES &&
      entity.category_id !== categoryId
    ) {
      return false;
    }
    if (!term) {
      return true;
    }
    return [entity.name_ar, entity.name, entity.id].some((value) =>
      normalize(value).includes(term),
    );
  });
}

// The public page groups entities by category and the backend numbers
// order_column per category, so an arrow press has to move an entity inside its
// own category instead of the category-mixed admin list.
export function officialEntityOrders(
  entities: readonly AdminOfficialEntity[],
): Map<string, OfficialEntityOrder> {
  const byCategory = new Map<string, string[]>();
  for (const entity of entities) {
    const siblings = byCategory.get(entity.category_id) ?? [];
    siblings.push(entity.id);
    byCategory.set(entity.category_id, siblings);
  }

  const orders = new Map<string, OfficialEntityOrder>();
  for (const siblings of byCategory.values()) {
    siblings.forEach((id, index) => orders.set(id, { index, siblings }));
  }
  return orders;
}
