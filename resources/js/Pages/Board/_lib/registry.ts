import { clockWidget } from '../_widgets/clock';
import { guidesWidget } from '../_widgets/guides';
import { notesWidget } from '../_widgets/notes';
import { placesNearbyWidget } from '../_widgets/places-nearby';
import { prayerWidget } from '../_widgets/prayer';
import { rssWidget } from '../_widgets/rss';
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
  rssWidget,
  transitCitiesWidget,
  notesWidget,
];

export const WIDGETS_BY_ID: Record<string, WidgetDefinition<any>> = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w]),
);

export function findWidget(id: string): WidgetDefinition<any> | undefined {
  return WIDGETS_BY_ID[id];
}

// Widgets seeded onto a brand new board, in order. Unregistered ids are skipped
// so this list can name a widget before it ships.
const SEED_IDS = ['clock', 'weather', 'prayer', 'places-nearby', 'guides', 'notes'];

export function defaultDoc(): BoardDoc {
  const widgets = SEED_IDS
    .map(findWidget)
    .filter((def): def is WidgetDefinition<any> => def !== undefined)
    .map((def) => ({
      i: newId('w'),
      d: def.id,
      w: def.defaultSize.w,
      h: def.defaultSize.h,
      c: defaultConfig(def),
    }));

  return {
    v: 1,
    activeId: 'd_main',
    updatedAt: nowStamp(),
    dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets }],
  };
}
