import { lazy } from 'react';
import { Radio } from 'lucide-react';
import type { WidgetDefinition } from '../../_lib/types';

export interface QuranConfig {
  defaultStationId?: string;
}

export const quranWidget: WidgetDefinition<QuranConfig> = {
  id: 'quran',
  name: 'إذاعة القرآن الكريم',
  description: 'استمع للبث المباشر لإذاعات القرآن الكريم عبر MP3Quran',
  icon: Radio,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 3 },
  fields: [],
  requires: [],
  refresh: { staleMs: 24 * 60 * 60_000, intervalMs: null },
  multiple: true,
  Component: lazy(() => import('./View')),
};
