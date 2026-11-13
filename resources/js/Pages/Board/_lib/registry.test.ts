import { describe, expect, it } from 'vitest';
import { allowedSizes, clampSize } from './doc';
import {
  GALLERY_CATEGORIES,
  WIDGETS,
  WIDGET_SOURCES,
  defaultDoc,
  findWidget,
} from './registry';
import { activeDashboard, addWidget, migrate, resizeWidget } from './layout';
import { sources } from './sources';
import { CATEGORIES, GRID_COLS, GRID_ROWS, type BoardDoc, type WidgetInstance } from './types';

/** The widget a test resizes, picked by id so a renamed folder fails loudly. */
function widgetDef(id: string) {
  const def = findWidget(id);
  if (!def) throw new Error(`The board registry lost the ${id} widget.`);
  return def;
}

function boardWith(widgets: WidgetInstance[]): BoardDoc {
  return {
    v: 1,
    activeId: 'd_main',
    updatedAt: '2026-07-18T09:12:44.120Z',
    dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets }],
  };
}

describe('widget registry', () => {
  it('registers every folder once, under the id its folder names', () => {
    const ids = WIDGETS.map((def) => def.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findWidget(id)?.id).toBe(id);
    expect(findWidget('no-such-widget')).toBeUndefined();
  });

  it('only uses categories the gallery renders, and shows a section only when it holds a widget', () => {
    const declared = CATEGORIES.map((category) => category.id as string);

    for (const def of WIDGETS) expect(declared).toContain(def.category);

    expect(GALLERY_CATEGORIES.map((category) => category.id)).toEqual(
      CATEGORIES.map((category) => category.id).filter((id) => WIDGETS.some((def) => def.category === id)),
    );
  });

  it('orders the gallery by category, then by the seeded board order', () => {
    const order = CATEGORIES.map((category) => category.id as string);
    const positions = WIDGETS.map((def) => order.indexOf(def.category));

    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('declares sizes inside the grid and inside each widget\'s own bounds', () => {
    for (const def of WIDGETS) {
      const { minSize, maxSize, defaultSize } = def;
      expect(minSize.w, def.id).toBeGreaterThanOrEqual(1);
      expect(minSize.h, def.id).toBeGreaterThanOrEqual(1);
      expect(maxSize.w, def.id).toBeLessThanOrEqual(GRID_COLS);
      expect(maxSize.h, def.id).toBeLessThanOrEqual(GRID_ROWS);
      expect(defaultSize.w, def.id).toBeGreaterThanOrEqual(minSize.w);
      expect(defaultSize.w, def.id).toBeLessThanOrEqual(maxSize.w);
      expect(defaultSize.h, def.id).toBeGreaterThanOrEqual(minSize.h);
      expect(defaultSize.h, def.id).toBeLessThanOrEqual(maxSize.h);
    }
  });

  it('offers in the size menu only sizes inside the widget\'s bounds', () => {
    for (const def of WIDGETS) {
      const { widths, heights } = allowedSizes(def);

      expect(widths.length, def.id).toBeGreaterThan(0);
      expect(heights.length, def.id).toBeGreaterThan(0);
      expect(widths, def.id).toContain(def.defaultSize.w);
      expect(heights, def.id).toContain(def.defaultSize.h);
      for (const w of widths) expect(w >= def.minSize.w && w <= def.maxSize.w).toBe(true);
      for (const h of heights) expect(h >= def.minSize.h && h <= def.maxSize.h).toBe(true);
    }
  });

  it('derives the source table from the declarations, and every source exists', () => {
    const declared = WIDGET_SOURCES.map((entry) => entry.id);

    expect(declared).toEqual(WIDGETS.filter((def) => def.source !== null).map((def) => def.id));
    for (const entry of WIDGET_SOURCES) {
      expect(typeof entry.source, entry.id).toBe('function');
    }

    // Every read in the module is claimed by a widget, and no widget claims one
    // twice: a new fetcher must come with the widget that uses it.
    const claimed = WIDGET_SOURCES.map((entry) => entry.source);
    expect(new Set(claimed).size).toBe(claimed.length);
    expect(claimed).toEqual(expect.arrayContaining(Object.values(sources)));
  });
});

describe('size bounds', () => {
  it('clamps to the widget\'s bounds and the grid caps in one place', () => {
    for (const def of WIDGETS) {
      expect(clampSize({ w: 99, h: 99 }, def)).toEqual({ w: def.maxSize.w, h: def.maxSize.h });
      expect(clampSize({ w: 0, h: 0 }, def)).toEqual({ w: def.minSize.w, h: def.minSize.h });
      expect(clampSize({ w: -5, h: 2.4 }, def).w).toBe(def.minSize.w);
    }

    expect(clampSize({ w: 99, h: 99 })).toEqual({ w: GRID_COLS, h: GRID_ROWS });
  });

  it('stores a resize clamped, whichever caller asks for it', () => {
    const doc = boardWith([{ i: 'w_clock', d: 'clock', w: 4, h: 2, c: { format: '24' } }]);

    const grown = activeDashboard(resizeWidget(doc, 'w_clock', { w: 40, h: 40 })).widgets[0];
    const shrunk = activeDashboard(resizeWidget(doc, 'w_clock', { w: 0, h: 0 })).widgets[0];
    const clock = widgetDef('clock');

    expect({ w: grown.w, h: grown.h }).toEqual({ w: clock.maxSize.w, h: clock.maxSize.h });
    expect({ w: shrunk.w, h: shrunk.h }).toEqual({ w: clock.minSize.w, h: clock.minSize.h });
  });

  it('keeps an unknown widget inside the grid caps', () => {
    const doc = boardWith([{ i: 'w_ghost', d: 'ghost', w: 4, h: 2, c: {} }]);

    const resized = activeDashboard(resizeWidget(doc, 'w_ghost', { w: 40, h: 40 })).widgets[0];

    expect({ w: resized.w, h: resized.h }).toEqual({ w: GRID_COLS, h: GRID_ROWS });
  });

  it('clamps a widget added from the gallery to its own bounds', () => {
    const doc = addWidget(boardWith([]), widgetDef('clock'));
    const added = activeDashboard(doc).widgets[0];

    expect({ w: added.w, h: added.h }).toEqual(widgetDef('clock').defaultSize);
  });
});

describe('seeded board', () => {
  it('is built from the declarations, in their declared order', () => {
    const seeded = WIDGETS.filter((def) => def.seed !== null)
      .sort((a, b) => (a.seed?.order ?? 0) - (b.seed?.order ?? 0));
    const widgets = activeDashboard(defaultDoc()).widgets;

    expect(widgets.map((widget) => widget.d)).toEqual(seeded.map((def) => def.id));
    for (const [index, widget] of widgets.entries()) {
      expect({ w: widget.w, h: widget.h }).toEqual(clampSize(seeded[index].seed ?? seeded[index].defaultSize, seeded[index]));
      expect(widget.c).toEqual(Object.fromEntries(seeded[index].fields.map((field) => [field.key, field.default])));
    }
  });
});

describe('stored document', () => {
  // A v1 document written by the shipped board: two dashboards, an unknown
  // widget on the second (added by a newer client), a large and a small size,
  // nested config, and PHP's `[]` for an empty config object.
  const stored = {
    v: 1,
    activeId: 'd_main',
    updatedAt: '2026-07-18T09:12:44.120Z',
    dashboards: [
      {
        id: 'd_main',
        name: 'الرئيسية',
        widgets: [
          { i: 'w_k3n1', d: 'clock', w: 4, h: 2, c: { format: '24', showDate: true } },
          { i: 'w_k3n2', d: 'todo', w: 12, h: 8, c: { hideCompleted: false, items: [{ id: 't1', text: 'نداء', done: true }] } },
          { i: 'w_k3n3', d: 'rss', w: 6, h: 3, c: { source: 'sana' } },
        ],
      },
      {
        id: 'd_second',
        name: 'ثانية',
        widgets: [
          { i: 'w_k3n4', d: 'added-on-another-device', w: 2, h: 1, c: { keep: ['me'], nested: { a: 1 } } },
          { i: 'w_k3n5', d: 'notes', w: 2, h: 1, c: {} },
        ],
      },
    ],
  };

  it('round-trips a document saved before the registry change unchanged', () => {
    const migrated = migrate(JSON.parse(JSON.stringify(stored)), defaultDoc());

    expect(migrated).toEqual(stored);
    // And a second trip through storage and the server changes nothing.
    expect(migrate(JSON.parse(JSON.stringify(migrated)), defaultDoc())).toEqual(stored);
  });

  it('still refuses a document it cannot represent', () => {
    const fallback = defaultDoc();

    expect(migrate(null, fallback)).toEqual(fallback);
    expect(migrate({ ...stored, v: 99 }, fallback)).toEqual(fallback);
    expect(migrate({ ...stored, dashboards: [] }, fallback)).toEqual(fallback);
  });
});
