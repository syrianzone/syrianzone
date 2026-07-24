import { answersWidget } from '../_widgets/answers';
import { clockWidget } from '../_widgets/clock';
import { eventsTodayWidget } from '../_widgets/events-today';
import { guidesWidget } from '../_widgets/guides';
import { notesWidget } from '../_widgets/notes';
import { placesNearbyWidget } from '../_widgets/places-nearby';
import { pomodoroWidget } from '../_widgets/pomodoro';
import { prayerWidget } from '../_widgets/prayer';
import { recipeWidget } from '../_widgets/recipe';
import { rssWidget } from '../_widgets/rss';
import { todoWidget } from '../_widgets/todo';
import { transitCitiesWidget } from '../_widgets/transit-cities';
import { weatherWidget } from '../_widgets/weather';
import { defaultConfig, newId, nowStamp } from './layout';
import type { BoardDoc, WidgetDefinition } from './types';

// The one manifest. Adding a widget is a new folder plus one line here, and
// nothing else in the core changes.
//
// Deliberately not import.meta.glob: it kills config generic inference and
// hides the dependency graph to save a single line.
export const WIDGETS: WidgetDefinition<any>[] = [
  clockWidget,
  weatherWidget,
  prayerWidget,
  placesNearbyWidget,
  guidesWidget,
  answersWidget,
  eventsTodayWidget,
  rssWidget,
  transitCitiesWidget,
  recipeWidget,
  notesWidget,
  todoWidget,
  pomodoroWidget,
];

export const WIDGETS_BY_ID: Record<string, WidgetDefinition<any>> = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w]),
);

export function findWidget(id: string): WidgetDefinition<any> | undefined {
  return WIDGETS_BY_ID[id];
}

// The default board. Array order is grid order, and in RTL the first item lands
// on the RIGHT, so each row reads right to left: the row rendered as
// clock | prayer | weather on screen is stored weather, prayer, clock.
//
// Explicit sizes rather than each widget's defaultSize, so the seeded
// arrangement is the intended 3 / 2 / 3 / 2 grid. Unregistered ids are skipped,
// so this list can name a widget before it ships.
const SEED_LAYOUT: { id: string; w: number; h: number }[] = [
  // row 1: clock, prayer, weather (screen left to right)
  { id: 'weather', w: 4, h: 2 },
  { id: 'prayer', w: 4, h: 2 },
  { id: 'clock', w: 4, h: 2 },
  // row 2: answers, news
  { id: 'rss', w: 6, h: 3 },
  { id: 'answers', w: 6, h: 3 },
  // row 3: todo, notes, recipe
  { id: 'recipe', w: 4, h: 4 },
  { id: 'notes', w: 4, h: 4 },
  { id: 'todo', w: 4, h: 4 },
  // row 4: events, pomodoro
  { id: 'pomodoro', w: 6, h: 3 },
  { id: 'events-today', w: 6, h: 3 },
];

export function defaultDoc(): BoardDoc {
  const widgets = SEED_LAYOUT.flatMap((seed) => {
    const def = findWidget(seed.id);
    if (!def) return [];
    // clamp to the widget's own bounds so a seed size can never violate min/max
    const w = Math.min(Math.max(seed.w, def.minSize.w), def.maxSize.w);
    const h = Math.min(Math.max(seed.h, def.minSize.h), def.maxSize.h);
    return [{ i: newId('w'), d: def.id, w, h, c: defaultConfig(def) }];
  });

  return {
    v: 1,
    activeId: 'd_main',
    updatedAt: nowStamp(),
    dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets }],
  };
}
