import { lazy } from 'react';
import { CalendarDays } from 'lucide-react';
import { GOVERNORATE_OPTIONS } from '../../_lib/governorates';
import type { WidgetDefinition } from '../../_lib/types';

export interface EventsTodayConfig {
  governorate: string;
}

// 'all' is not a governorate, it is the no-province-filter option the proxy
// accepts alongside the fixed list.
export const ALL_SYRIA = 'all';

export const eventsTodayWidget: WidgetDefinition<EventsTodayConfig> = {
  id: 'events-today',
  name: 'فعاليات اليوم',
  description: 'الفعاليات الجارية اليوم في محافظتك',
  icon: CalendarDays,
  category: 'community',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  fields: [
    {
      key: 'governorate',
      type: 'select',
      label: 'المحافظة',
      default: 'damascus',
      options: [...GOVERNORATE_OPTIONS, { value: ALL_SYRIA, label: 'كل سوريا' }],
    },
  ],
  requires: [],
  // the endpoint caches for 10 minutes server-side, so polling faster only
  // re-serves the same payload
  refresh: { staleMs: 10 * 60_000, intervalMs: 15 * 60_000 },
  multiple: true,
  Component: lazy(() => import('./View')),
};
