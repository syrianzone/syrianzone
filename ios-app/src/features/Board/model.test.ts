import { describe, expect, test } from 'bun:test';
import { addDashboard, addWidget, defaultDocument, migrate, moveWidget, packWidgets, removeDashboard, resizeWidget, widgets } from './model';

describe('native Board v1 compatibility', () => {
  test('registers all fourteen widgets and preserves the ten seeded definitions in source order', () => {
    expect(widgets.map(widget => widget.id).sort()).toEqual(['answers', 'clock', 'events-today', 'guides', 'notes', 'places-nearby', 'pomodoro', 'prayer', 'quran', 'recipe', 'rss', 'todo', 'transit-cities', 'weather']);
    expect(defaultDocument().dashboards[0]?.widgets.map(widget => widget.d))
      .toEqual(['weather', 'prayer', 'clock', 'quran', 'pomodoro', 'recipe', 'rss', 'answers', 'notes', 'todo']);
  });
  test('round trips unknown widget definitions and opaque configuration from another client', () => {
    const document = { v: 1 as const, activeId: 'main', updatedAt: '2026-11-14T00:00:00Z', dashboards: [{ id: 'main', name: 'لوحتي', widgets: [{ i: 'future', d: 'future-widget', w: 6, h: 3, c: { future: ['leave', { intact: true }] } }] }] };
    expect(migrate(document)).toEqual(document);
    expect(migrate({ ...document, v: 2 }).dashboards[0]?.widgets).not.toHaveLength(1);
  });
  test('clamps resizing to each declaration and keeps the final dashboard', () => {
    const document = defaultDocument(), clock = document.dashboards[0]?.widgets.find(widget => widget.d === 'clock');
    if (!clock) throw new Error('clock missing');
    expect(resizeWidget(document, clock.i, 99, 99).dashboards[0]?.widgets.find(widget => widget.i === clock.i))
      .toMatchObject({ w: 12, h: 2 });
    expect(removeDashboard(document, document.activeId)).toBe(document);
    let next = document;
    for (let index = 0; index < 12; index++) next = addDashboard(next, 'جديدة');
    expect(next.dashboards).toHaveLength(10);
  });
  test('reorders by stable instance IDs without mutating config and rejects a duplicate singleton', () => {
    const document = defaultDocument(), list = document.dashboards[0]?.widgets ?? [];
    const first = list[0], last = list.at(-1);
    if (!first || !last) throw new Error('seed missing');
    const moved = moveWidget(document, first.i, last.i);
    expect(moved.dashboards[0]?.widgets.at(-1)).toEqual(first);
    expect(document.dashboards[0]?.widgets[0]).toEqual(first);
    expect(addWidget(document, 'prayer')).toBe(document);
    expect(addWidget(document, 'notes').dashboards[0]?.widgets).toHaveLength(11);
  });
  test('packs discrete spans without overlapping and retains one stored size across column counts', () => {
    const document = defaultDocument(), list = document.dashboards[0]?.widgets ?? [];
    for (const columns of [2, 6, 12]) {
      const rectangles = packWidgets(list, columns);
      expect(rectangles).toHaveLength(list.length);
      for (const [index, rectangle] of rectangles.entries()) {
        expect(rectangle.x + rectangle.w).toBeLessThanOrEqual(columns);
        for (const other of rectangles.slice(index + 1)) {
          expect(rectangle.x < other.x + other.w && rectangle.x + rectangle.w > other.x && rectangle.y < other.y + other.h && rectangle.y + rectangle.h > other.y).toBe(false);
        }
      }
    }
    expect(list[0]?.w).toBe(4);
  });
});
