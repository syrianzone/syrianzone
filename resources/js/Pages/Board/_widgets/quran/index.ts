import { Radio } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';

export interface QuranConfig {}

export const quranWidget: WidgetDeclaration = {
  id: 'quran',
  name: 'إذاعة القرآن الكريم',
  description: 'تلاوة متابَعة متواصلة مع نصّ ما يُقرأ، مشتركة مع الركن الإسلامي',
  icon: Radio,
  category: 'time',
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 3 },
  fields: [],
  requires: [],
  refresh: { staleMs: 24 * 60 * 60_000, intervalMs: null },
  multiple: true,
  seed: { order: 4, w: 4, h: 2 },
  source: null,
};

export default quranWidget;
