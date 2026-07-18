import type { BoardDoc, Breakpoint, DashboardDef, WidgetDefinition, WidgetInstance, WidgetSize } from './types';

export const DOC_VERSION = 1;
export const MAX_DASHBOARDS = 10;
export const MAX_WIDGETS = 40;
export const GRID_COLS = 12;

// Mirrors the container's grid-cols-2 / md:grid-cols-6 / lg:grid-cols-12.
// One stored width renders at three breakpoints, so the document never holds
// per-breakpoint copies.
export function colsAt(bp: Breakpoint): number {
  return bp === 'sm' ? 2 : bp === 'md' ? 6 : GRID_COLS;
}

export function spanAt(w: number, bp: Breakpoint): number {
  return Math.min(w, colsAt(bp));
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowStamp(): string {
  return new Date().toISOString();
}

// PHP decodes an empty JSON object as [], so a config that round-trips through
// the server comes back as an array. Coerce it back rather than letting widgets
// each guard against it.
export function normalizeConfig(c: unknown): Record<string, unknown> {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return {};
  return c as Record<string, unknown>;
}

export function defaultConfig(def: WidgetDefinition): Record<string, unknown> {
  return Object.fromEntries(def.fields.map((f) => [f.key, f.default]));
}

export function clampSize(def: WidgetDefinition, size: WidgetSize): WidgetSize {
  return {
    w: Math.min(Math.max(size.w, def.minSize.w), def.maxSize.w),
    h: Math.min(Math.max(size.h, def.minSize.h), def.maxSize.h),
  };
}

// ***** parsing *****
// Never throws. A corrupt localStorage entry or an unreadable server document
// must fall back to defaults, not white-screen /board.

function isWidget(v: unknown): v is WidgetInstance {
  const w = v as WidgetInstance;
  return !!w && typeof w === 'object'
    && typeof w.i === 'string' && w.i.length > 0 && w.i.length <= 40
    && typeof w.d === 'string' && w.d.length > 0 && w.d.length <= 40
    && Number.isInteger(w.w) && w.w >= 1 && w.w <= GRID_COLS
    && Number.isInteger(w.h) && w.h >= 1 && w.h <= 8;
}

function isDashboard(v: unknown): v is DashboardDef {
  const d = v as DashboardDef;
  return !!d && typeof d === 'object'
    && typeof d.id === 'string' && d.id.length > 0 && d.id.length <= 40
    && typeof d.name === 'string' && d.name.length > 0 && d.name.length <= 40
    && Array.isArray(d.widgets);
}

export function isBoardDoc(v: unknown): v is BoardDoc {
  const doc = v as BoardDoc;
  return !!doc && typeof doc === 'object'
    && Number.isInteger(doc.v) && doc.v >= 1
    && typeof doc.activeId === 'string'
    && typeof doc.updatedAt === 'string'
    && Array.isArray(doc.dashboards) && doc.dashboards.length > 0
    && doc.dashboards.every(isDashboard);
}

// Drops only what it cannot represent, and keeps unknown widget definition ids:
// an older client must not silently delete a widget added on another device.
function sanitize(doc: BoardDoc): BoardDoc {
  const dashboards = doc.dashboards.slice(0, MAX_DASHBOARDS).map((d) => ({
    id: d.id,
    name: d.name,
    widgets: d.widgets.filter(isWidget).slice(0, MAX_WIDGETS).map((w) => ({
      i: w.i, d: w.d, w: w.w, h: w.h, c: normalizeConfig(w.c),
    })),
  }));
  const activeId = dashboards.some((d) => d.id === doc.activeId) ? doc.activeId : dashboards[0].id;
  return { v: DOC_VERSION, activeId, updatedAt: doc.updatedAt, dashboards };
}

// Each step upgrades one version. Add to the chain, never edit a shipped step.
const STEPS: Record<number, (doc: BoardDoc) => BoardDoc> = {};

export function migrate(raw: unknown, fallback: BoardDoc): BoardDoc {
  try {
    if (!isBoardDoc(raw)) return fallback;
    let doc = raw;
    while (doc.v < DOC_VERSION) {
      const step = STEPS[doc.v];
      if (!step) return fallback;
      doc = step(doc);
    }
    // A document from a newer client is not downgradable; keep the user's
    // defaults locally rather than corrupting what the other device wrote.
    if (doc.v > DOC_VERSION) return fallback;
    return sanitize(doc);
  } catch {
    return fallback;
  }
}

// ***** mutations *****
// All pure: they return a new document with a fresh updatedAt, and the caller
// persists. Index.tsx owns the document, matching Places/Index.tsx.

function mapActive(doc: BoardDoc, fn: (d: DashboardDef) => DashboardDef): BoardDoc {
  return {
    ...doc,
    updatedAt: nowStamp(),
    dashboards: doc.dashboards.map((d) => (d.id === doc.activeId ? fn(d) : d)),
  };
}

export function activeDashboard(doc: BoardDoc): DashboardDef {
  return doc.dashboards.find((d) => d.id === doc.activeId) ?? doc.dashboards[0];
}

export function addWidget(doc: BoardDoc, def: WidgetDefinition): BoardDoc {
  if (activeDashboard(doc).widgets.length >= MAX_WIDGETS) return doc;
  const widget: WidgetInstance = {
    i: newId('w'),
    d: def.id,
    w: def.defaultSize.w,
    h: def.defaultSize.h,
    c: defaultConfig(def),
  };
  return mapActive(doc, (d) => ({ ...d, widgets: [...d.widgets, widget] }));
}

export function removeWidget(doc: BoardDoc, instanceId: string): BoardDoc {
  return mapActive(doc, (d) => ({ ...d, widgets: d.widgets.filter((w) => w.i !== instanceId) }));
}

export function resizeWidget(doc: BoardDoc, instanceId: string, size: WidgetSize): BoardDoc {
  return mapActive(doc, (d) => ({
    ...d,
    widgets: d.widgets.map((w) => (w.i === instanceId ? { ...w, w: size.w, h: size.h } : w)),
  }));
}

export function updateWidgetConfig(doc: BoardDoc, instanceId: string, patch: Record<string, unknown>): BoardDoc {
  return mapActive(doc, (d) => ({
    ...d,
    widgets: d.widgets.map((w) => (w.i === instanceId ? { ...w, c: { ...w.c, ...patch } } : w)),
  }));
}

// Position is array index, so reordering is a splice. No x/y, no compaction.
export function moveWidget(doc: BoardDoc, fromId: string, toId: string): BoardDoc {
  return mapActive(doc, (d) => {
    const from = d.widgets.findIndex((w) => w.i === fromId);
    const to = d.widgets.findIndex((w) => w.i === toId);
    if (from < 0 || to < 0 || from === to) return d;
    const widgets = d.widgets.slice();
    const [moved] = widgets.splice(from, 1);
    widgets.splice(to, 0, moved);
    return { ...d, widgets };
  });
}

export function addDashboard(doc: BoardDoc, name: string): BoardDoc {
  if (doc.dashboards.length >= MAX_DASHBOARDS) return doc;
  const dashboard: DashboardDef = { id: newId('d'), name, widgets: [] };
  return { ...doc, updatedAt: nowStamp(), activeId: dashboard.id, dashboards: [...doc.dashboards, dashboard] };
}

export function renameDashboard(doc: BoardDoc, id: string, name: string): BoardDoc {
  return {
    ...doc,
    updatedAt: nowStamp(),
    dashboards: doc.dashboards.map((d) => (d.id === id ? { ...d, name } : d)),
  };
}

// The last dashboard is never removable: the document must always have one.
export function removeDashboard(doc: BoardDoc, id: string): BoardDoc {
  if (doc.dashboards.length <= 1) return doc;
  const dashboards = doc.dashboards.filter((d) => d.id !== id);
  const activeId = dashboards.some((d) => d.id === doc.activeId) ? doc.activeId : dashboards[0].id;
  return { ...doc, updatedAt: nowStamp(), activeId, dashboards };
}

export function selectDashboard(doc: BoardDoc, id: string): BoardDoc {
  if (!doc.dashboards.some((d) => d.id === id)) return doc;
  return { ...doc, updatedAt: nowStamp(), activeId: id };
}
