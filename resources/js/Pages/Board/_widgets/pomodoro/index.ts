import { lazy } from 'react';
import { Timer } from 'lucide-react';
import type { WidgetDefinition } from '../../_lib/types';

export interface PomodoroConfig {
  work: number;
  rest: number;
}

export const pomodoroWidget: WidgetDefinition<PomodoroConfig> = {
  id: 'pomodoro',
  name: 'مؤقّت بومودورو',
  description: 'جلسات عمل وراحة بمؤقّت بسيط',
  icon: Timer,
  category: 'personal',
  // phase label, the MM:SS readout, the progress bar and one row of buttons:
  // h:3 is the smallest that fits all four without scrolling.
  defaultSize: { w: 4, h: 2 },
  minSize: { w: 3, h: 2 },
  maxSize: { w: 6, h: 4 },
  // Only the durations persist. The running countdown deliberately does not:
  // see the comment in View.tsx.
  fields: [
    { key: 'work', type: 'number', label: 'دقائق العمل', default: 25, min: 5, max: 90 },
    { key: 'rest', type: 'number', label: 'دقائق الراحة', default: 5, min: 1, max: 30 },
  ],
  requires: [],
  refresh: { staleMs: 0, intervalMs: null },
  multiple: false,
  Component: lazy(() => import('./View')),
};
