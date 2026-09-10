import { lazy } from 'react';
import { Moon } from 'lucide-react';
import { GOVERNORATE_OPTIONS } from '../../_lib/governorates';
import type { WidgetDefinition } from '../../_lib/types';

export interface PrayerConfig {
  governorate: string;
  /** AlAdhan calculation method id as string ('3' = Muslim World League). */
  method?: string;
}

export const prayerWidget: WidgetDefinition<PrayerConfig> = {
  id: 'prayer',
  name: 'مواقيت الصلاة',
  description: 'الصلاة القادمة والوقت المتبقي — يتبع موقعك المحفوظ (GPS/IP) أو مدينة يدوية',
  icon: Moon,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 1 },
  maxSize: { w: 6, h: 4 },
  fields: [
    { key: 'governorate', type: 'select', label: 'المحافظة', default: 'damascus', options: GOVERNORATE_OPTIONS },
    {
      key: 'method',
      type: 'select',
      label: 'طريقة الحساب',
      default: '3',
      options: [
        { value: '3', label: 'رابطة العالم الإسلامي (سوريا)' },
        { value: '5', label: 'الهيئة المصرية للمساحة' },
        { value: '4', label: 'جامعة أم القرى (مكة)' },
        { value: '1', label: 'كراتشي' },
        { value: '2', label: 'أمريكا الشمالية (ISNA)' },
      ],
    },
  ],
  requires: [],
  // timings are fixed for the day; the countdown ticks locally
  refresh: { staleMs: 6 * 60 * 60_000, intervalMs: null },
  multiple: false,
  Component: lazy(() => import('./View')),
};
