import { CloudSun } from 'lucide-react';
import { governorateOptions } from '@/Domain/geography/governorates';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export interface WeatherConfig {
  governorate: string;
}

export const weatherWidget: WidgetDeclaration = {
  id: 'weather',
  name: 'الطقس',
  description: 'درجة الحرارة والحالة الجوية',
  icon: CloudSun,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 1 },
  maxSize: { w: 6, h: 2 },
  fields: [
    { key: 'governorate', type: 'select', label: 'المحافظة', default: 'damascus', options: governorateOptions() },
  ],
  requires: [],
  refresh: { staleMs: 10 * 60_000, intervalMs: 15 * 60_000 },
  multiple: true,
  seed: { order: 1, w: 4, h: 2 },
  source: sources.weather,
};

export default weatherWidget;
