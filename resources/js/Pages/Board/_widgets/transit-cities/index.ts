import { lazy } from 'react';
import { Bus } from 'lucide-react';
import type { WidgetDefinition } from '../../_lib/types';

export const transitCitiesWidget: WidgetDefinition<Record<string, never>> = {
  id: 'transit-cities',
  name: 'المواصلات',
  description: 'المدن وعدد الخطوط المنشورة',
  icon: Bus,
  category: 'transit',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  fields: [],
  requires: [],
  // the endpoint caches for an hour server-side
  refresh: { staleMs: 30 * 60_000, intervalMs: null },
  multiple: false,
  Component: lazy(() => import('./View')),
};
