import { ChefHat } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export const recipeWidget: WidgetDeclaration = {
  id: 'recipe',
  name: 'وصفة اليوم',
  description: 'وصفة سورية مختارة كل يوم من وصفاتنا',
  icon: ChefHat,
  category: 'food',
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 5 },
  fields: [],
  requires: [],
  // the pick is fixed for the whole day server-side, so polling buys nothing
  refresh: { staleMs: 6 * 60 * 60_000, intervalMs: null },
  multiple: false,
  seed: { order: 6, w: 4, h: 3 },
  source: sources.recipeOfTheDay,
};

export default recipeWidget;
