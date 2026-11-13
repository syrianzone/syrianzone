import { Bus } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export const transitCitiesWidget: WidgetDeclaration = {
  id: 'transit-cities',
  name: 'المواصلات',
  description: 'المدن وعدد الخطوط المنشورة',
  icon: Bus,
  category: 'places',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  fields: [],
  requires: [],
  // the endpoint caches for an hour server-side
  refresh: { staleMs: 30 * 60_000, intervalMs: null },
  multiple: false,
  seed: null,
  source: sources.transitCities,
};

export default transitCitiesWidget;
