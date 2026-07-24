import { lazy } from 'react';
import { CloudSun } from 'lucide-react';
import { GOVERNORATE_OPTIONS } from '../../_lib/governorates';
import type { WidgetDefinition } from '../../_lib/types';

export interface WeatherConfig {
  governorate: string;
}

export const weatherWidget: WidgetDefinition<WeatherConfig> = {
  id: 'weather',
  name: 'الطقس',
  description: 'درجة الحرارة والحالة الجوية',
  icon: CloudSun,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 1 },
  maxSize: { w: 6, h: 2 },
  fields: [
    { key: 'governorate', type: 'select', label: 'المحافظة', default: 'damascus', options: GOVERNORATE_OPTIONS },
  ],
  requires: [],
  refresh: { staleMs: 10 * 60_000, intervalMs: 15 * 60_000 },
  multiple: true,
  Component: lazy(() => import('./View')),
};
