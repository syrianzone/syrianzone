import { MessageCircleQuestion } from 'lucide-react';
import type { WidgetDeclaration } from '../../_lib/types';
import { sources } from '../../_lib/sources';

export interface AnswersConfig {
  limit: number;
}

export const answersWidget: WidgetDeclaration = {
  id: 'answers',
  name: 'إجابات سوريا',
  description: 'أحدث الأسئلة من إجابات سوريا',
  icon: MessageCircleQuestion,
  category: 'community',
  defaultSize: { w: 6, h: 3 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 12, h: 6 },
  fields: [
    {
      key: 'limit',
      type: 'number',
      label: 'عدد الأسئلة',
      default: 8,
      min: 3,
      max: 20,
    },
  ],
  requires: [],
  // the endpoint caches for 5 minutes server-side, so polling faster than that
  // only ever re-reads our own cache
  refresh: { staleMs: 5 * 60_000, intervalMs: 10 * 60_000 },
  multiple: false,
  seed: { order: 8, w: 6, h: 3 },
  source: sources.answers,
};

export default answersWidget;
