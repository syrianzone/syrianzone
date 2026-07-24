import {
  MAX_DASHBOARDS,
  MAX_DOCUMENT_BYTES,
  MAX_WIDGETS,
  activeDashboard,
  addDashboard,
  addWidget,
  createDefaultDocument,
  documentByteLength,
  gridColumnsForViewport,
  migrateDocument,
  moveWidget,
  removeDashboard,
  removeWidget,
  renameDashboard,
  resizeWidget,
  selectDashboard,
  updateWidgetConfig,
  widgetWidthForViewport,
} from './model';
import { findWidget } from './registry';
import type { BoardDocument, WidgetInstance } from './types';

function fixtureDocument(widgets: WidgetInstance[] = []): BoardDocument {
  return {
    activeId: 'd_main',
    dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets }],
    updatedAt: '2026-07-24T10:00:00.000Z',
    v: 1,
  };
}

test('creates the exact versioned board document contract', () => {
  const document = createDefaultDocument();

  expect(Object.keys(document).sort()).toEqual([
    'activeId',
    'dashboards',
    'updatedAt',
    'v',
  ]);
  expect(document.v).toBe(1);
  expect(document.activeId).toBe(document.dashboards[0]?.id);
  expect(document.dashboards[0]?.widgets.length).toBeGreaterThan(0);
  expect(Object.keys(document.dashboards[0]?.widgets[0] ?? {}).sort()).toEqual([
    'c',
    'd',
    'h',
    'i',
    'w',
  ]);
  expect(documentByteLength(document)).toBe(
    Buffer.byteLength(JSON.stringify({ document }), 'utf8'),
  );
});

test('maps the stored twelve-column width onto phone and tablet grids', () => {
  expect(gridColumnsForViewport(390)).toBe(2);
  expect(gridColumnsForViewport(800)).toBe(6);
  expect(gridColumnsForViewport(1_200)).toBe(12);
  expect(widgetWidthForViewport(4, 390)).toBe(358);
  expect(widgetWidthForViewport(3, 800)).toBe(378);
  expect(widgetWidthForViewport(12, 1_200)).toBe(1_168);
});

test('migrates valid documents while preserving unknown widget definitions', () => {
  const fallback = createDefaultDocument();
  const unknown: BoardDocument = fixtureDocument([
    { c: { future: true }, d: 'future-widget', h: 3, i: 'w_future', w: 6 },
  ]);

  expect(migrateDocument(unknown, fallback)).toEqual(unknown);
  expect(migrateDocument({ ...unknown, v: 2 }, fallback)).toBe(fallback);
  expect(migrateDocument({ dashboards: [] }, fallback)).toBe(fallback);
});

test('sanitizes dashboards and widgets to the server limits', () => {
  const dashboards = Array.from({ length: MAX_DASHBOARDS + 3 }, (_, index) => ({
    id: `d_${index}`,
    name: `لوحة ${index}`,
    widgets: Array.from({ length: MAX_WIDGETS + 4 }, (__, widgetIndex) => ({
      c: [],
      d: 'clock',
      h: 2,
      i: `w_${index}_${widgetIndex}`,
      w: 4,
    })),
  }));
  const raw = {
    activeId: 'missing',
    dashboards,
    updatedAt: '2026-07-24T10:00:00.000Z',
    v: 1,
  };

  const migrated = migrateDocument(raw, createDefaultDocument());

  expect(migrated.dashboards).toHaveLength(MAX_DASHBOARDS);
  expect(migrated.dashboards[0]?.widgets).toHaveLength(MAX_WIDGETS);
  expect(migrated.dashboards[0]?.widgets[0]?.c).toEqual({});
  expect(migrated.activeId).toBe('d_0');
});

test('supports dashboard add, rename, switch, and delete without removing the last one', () => {
  let document = fixtureDocument();

  document = addDashboard(document, 'الثانية', () => 'd_second');
  expect(document.activeId).toBe('d_second');
  document = renameDashboard(document, 'd_second', 'رحلاتي');
  expect(activeDashboard(document).name).toBe('رحلاتي');
  document = selectDashboard(document, 'd_main');
  expect(document.activeId).toBe('d_main');
  document = removeDashboard(document, 'd_main');
  expect(document.activeId).toBe('d_second');
  expect(removeDashboard(document, 'd_second')).toBe(document);
});

test('caps dashboard creation at ten', () => {
  let document = fixtureDocument();
  for (let index = 1; index < MAX_DASHBOARDS + 2; index += 1) {
    document = addDashboard(document, `لوحة ${index}`, () => `d_${index}`);
  }
  expect(document.dashboards).toHaveLength(MAX_DASHBOARDS);
});

test('adds, reorders, resizes, configures, and removes widgets', () => {
  const clock = findWidget('clock');
  expect(clock).toBeDefined();
  let document = addWidget(
    fixtureDocument([
      { c: {}, d: 'notes', h: 4, i: 'w_notes', w: 4 },
    ]),
    clock!,
    () => 'w_clock',
  );

  document = moveWidget(document, 'w_clock', 'w_notes');
  expect(activeDashboard(document).widgets.map((widget) => widget.i)).toEqual([
    'w_clock',
    'w_notes',
  ]);
  document = resizeWidget(document, 'w_clock', { h: 1, w: 3 });
  document = updateWidgetConfig(document, 'w_clock', {
    format: '12',
    showDate: false,
  });
  expect(activeDashboard(document).widgets[0]).toMatchObject({
    c: { format: '12', showDate: false },
    h: 1,
    w: 3,
  });
  document = removeWidget(document, 'w_notes');
  expect(activeDashboard(document).widgets.map((widget) => widget.i)).toEqual([
    'w_clock',
  ]);
});

test('refuses mutations that would exceed the 64 KB document budget', () => {
  const notes = findWidget('notes');
  expect(notes).toBeDefined();
  const huge = fixtureDocument([
    {
      c: { text: 'س'.repeat(MAX_DOCUMENT_BYTES) },
      d: 'notes',
      h: 4,
      i: 'w_notes',
      w: 4,
    },
  ]);

  expect(documentByteLength(huge)).toBeGreaterThan(MAX_DOCUMENT_BYTES);
  expect(updateWidgetConfig(fixtureDocument([
    { c: {}, d: 'notes', h: 4, i: 'w_notes', w: 4 },
  ]), 'w_notes', { text: 'س'.repeat(MAX_DOCUMENT_BYTES) })).toEqual(
    fixtureDocument([
      { c: {}, d: 'notes', h: 4, i: 'w_notes', w: 4 },
    ]),
  );
});
