import { Users } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export interface GuidesConfig {
  sort: 'submissions' | 'saves' | 'recent';
}

export const guidesWidget: WidgetDeclaration = {
  id: 'guides',
  name: 'المرشدون',
  description: 'أكثر المساهمين في مشوار',
  icon: Users,
  category: 'community',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  fields: [
    {
      key: 'sort',
      type: 'select',
      label: 'الترتيب',
      default: 'submissions',
      options: [
        { value: 'submissions', label: 'الأكثر مساهمة' },
        { value: 'saves', label: 'الأكثر حفظاً' },
        { value: 'recent', label: 'النشطون مؤخراً' },
      ],
    },
  ],
  requires: [],
  // the endpoint caches for 5 minutes server-side
  refresh: { staleMs: 5 * 60_000, intervalMs: null },
  multiple: true,
  seed: null,
  source: sources.guides,
};

export default guidesWidget;
