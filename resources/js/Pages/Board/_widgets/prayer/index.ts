import { lazy } from 'react';
import { Moon } from 'lucide-react';
import { GOVERNORATE_OPTIONS } from '../../_lib/governorates';
import type { WidgetDefinition } from '../../_lib/types';

export interface PrayerConfig {
  governorate: string;
}

export const prayerWidget: WidgetDefinition<PrayerConfig> = {
  id: 'prayer',
  name: 'مواقيت الصلاة',
  description: 'الصلاة القادمة والوقت المتبقي',
  icon: Moon,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 1 },
  maxSize: { w: 6, h: 4 },
  fields: [
    { key: 'governorate', type: 'select', label: 'المحافظة', default: 'damascus', options: GOVERNORATE_OPTIONS },
  ],
  requires: [],
  // timings are fixed for the day; the countdown ticks locally
  refresh: { staleMs: 6 * 60 * 60_000, intervalMs: null },
  multiple: false,
  Component: lazy(() => import('./View')),
};
