import { Moon } from 'lucide-react';
import { GOVERNORATES_BY_ID, governorateOptions } from '@/Domain/geography/governorates';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

/** The "follow the site location" choice: not a governorate, so no city is pinned. */
export const FOLLOW_LOCATION = 'auto';

export interface PrayerConfig {
  /** A governorate id the tile pins, or `FOLLOW_LOCATION`/absent to follow the site. */
  governorate?: string;
  /** AlAdhan calculation method id as string ('3' = Muslim World League). */
  method?: string;
}

/** The city a stored config pins, or null when the tile follows the site location. */
export function configCity(config: PrayerConfig): string | null {
  const city = config.governorate;
  if (!city || city === FOLLOW_LOCATION) return null;
  return GOVERNORATES_BY_ID[city] ? city : null;
}

export const prayerWidget: WidgetDeclaration = {
  id: 'prayer',
  name: 'مواقيت الصلاة',
  description: 'الصلاة القادمة والوقت المتبقي — يتبع موقعك المحفوظ (GPS/IP) أو مدينة يدوية',
  icon: Moon,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 1 },
  maxSize: { w: 6, h: 4 },
  fields: [
    {
      key: 'governorate',
      type: 'select',
      label: 'المحافظة',
      // A new tile follows the one location setting everywhere; only an explicit
      // pick pins a city of its own (a stored document keeps what it stored).
      default: FOLLOW_LOCATION,
      options: [
        { value: FOLLOW_LOCATION, label: 'حسب موقعي' },
        ...governorateOptions(),
      ],
    },
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
  seed: { order: 2, w: 4, h: 2 },
  source: sources.prayerTimes,
};

export default prayerWidget;
