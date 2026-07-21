import { lazy } from 'react';
import { Clock } from 'lucide-react';
import type { WidgetDefinition } from '../../_lib/types';

export interface ClockConfig {
  format: '12' | '24';
  showDate: boolean;
}

export const clockWidget: WidgetDefinition<ClockConfig> = {
  id: 'clock',
  name: 'الساعة',
  description: 'الوقت والتاريخ الحالي',
  icon: Clock,
  category: 'time',
  // h:1 is 76px minus the ~37px shell header, which fits the time alone.
  // The date needs a second row.
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 2, h: 1 },
  maxSize: { w: 12, h: 2 },
  fields: [
    {
      key: 'format',
      type: 'select',
      label: 'صيغة الوقت',
      default: '24',
      options: [
        { value: '24', label: '24 ساعة' },
        { value: '12', label: '12 ساعة' },
      ],
    },
    { key: 'showDate', type: 'switch', label: 'إظهار التاريخ', default: true },
  ],
  requires: [],
  refresh: { staleMs: 0, intervalMs: null },
  multiple: true,
  Component: lazy(() => import('./View')),
};
