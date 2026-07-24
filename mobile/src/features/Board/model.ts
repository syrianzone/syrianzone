import { findWidget } from './registry';
import type {
  BoardDocument,
  DashboardDefinition,
  WidgetDefinition,
  WidgetInstance,
  WidgetSize,
} from './types';

export const DOCUMENT_VERSION = 1;
export const MAX_DASHBOARDS = 10;
export const MAX_DOCUMENT_BYTES = 65_536;
export const MAX_WIDGETS = 40;
const BOARD_GAP = 12;
const BOARD_HORIZONTAL_PADDING = 32;

export function gridColumnsForViewport(viewportWidth: number): number {
  return viewportWidth >= 1_024 ? 12 : viewportWidth >= 768 ? 6 : 2;
}

export function widgetWidthForViewport(
  storedWidth: number,
  viewportWidth: number,
): number {
  const columns = gridColumnsForViewport(viewportWidth);
  const span = Math.min(Math.max(1, storedWidth), columns);
  const available = Math.max(0, viewportWidth - BOARD_HORIZONTAL_PADDING);
  const unit = (available - BOARD_GAP * (columns - 1)) / columns;
  return Math.round(unit * span + BOARD_GAP * (span - 1));
}

export function documentByteLength(document: BoardDocument): number {
  let bytes = 0;
  for (const character of JSON.stringify({ document })) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes +=
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;
  }
  return bytes;
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function nowStamp(): string {
  return new Date().toISOString();
}

function defaultConfig(
  definition: WidgetDefinition,
): Record<string, unknown> {
  return Object.fromEntries(
    definition.fields.map((field) => [field.key, field.default]),
  );
}

function normalizeConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function isWidget(value: unknown): value is WidgetInstance {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const widget = value as WidgetInstance;
  return (
    typeof widget.i === 'string' &&
    widget.i.length > 0 &&
    widget.i.length <= 40 &&
    typeof widget.d === 'string' &&
    widget.d.length > 0 &&
    widget.d.length <= 40 &&
    Number.isInteger(widget.w) &&
    widget.w >= 1 &&
    widget.w <= 12 &&
    Number.isInteger(widget.h) &&
    widget.h >= 1 &&
    widget.h <= 8
  );
}

function isDashboard(value: unknown): value is DashboardDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const dashboard = value as DashboardDefinition;
  return (
    typeof dashboard.id === 'string' &&
    dashboard.id.length > 0 &&
    dashboard.id.length <= 40 &&
    typeof dashboard.name === 'string' &&
    dashboard.name.length > 0 &&
    dashboard.name.length <= 40 &&
    Array.isArray(dashboard.widgets)
  );
}

export function isBoardDocument(value: unknown): value is BoardDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const document = value as BoardDocument;
  return (
    Number.isInteger(document.v) &&
    document.v >= 1 &&
    typeof document.activeId === 'string' &&
    document.activeId.length > 0 &&
    document.activeId.length <= 40 &&
    typeof document.updatedAt === 'string' &&
    document.updatedAt.length > 0 &&
    document.updatedAt.length <= 40 &&
    Array.isArray(document.dashboards) &&
    document.dashboards.length > 0 &&
    document.dashboards.every(isDashboard)
  );
}

function sanitizeDocument(document: BoardDocument): BoardDocument {
  const dashboards = document.dashboards
    .slice(0, MAX_DASHBOARDS)
    .map((dashboard) => ({
      id: dashboard.id,
      name: dashboard.name,
      widgets: dashboard.widgets
        .filter(isWidget)
        .slice(0, MAX_WIDGETS)
        .map((widget) => ({
          c: normalizeConfig(widget.c),
          d: widget.d,
          h: widget.h,
          i: widget.i,
          w: widget.w,
        })),
    }));
  const activeId = dashboards.some(
    (dashboard) => dashboard.id === document.activeId,
  )
    ? document.activeId
    : dashboards[0]!.id;
  return {
    activeId,
    dashboards,
    updatedAt: document.updatedAt,
    v: DOCUMENT_VERSION,
  };
}

export function migrateDocument(
  raw: unknown,
  fallback: BoardDocument,
): BoardDocument {
  try {
    if (!isBoardDocument(raw) || raw.v !== DOCUMENT_VERSION) {
      return fallback;
    }
    const document = sanitizeDocument(raw);
    return documentByteLength(document) <= MAX_DOCUMENT_BYTES
      ? document
      : fallback;
  } catch {
    return fallback;
  }
}

const seedLayout = [
  { h: 2, id: 'weather', w: 4 },
  { h: 2, id: 'prayer', w: 4 },
  { h: 2, id: 'clock', w: 4 },
  { h: 3, id: 'rss', w: 6 },
  { h: 3, id: 'answers', w: 6 },
  { h: 4, id: 'recipe', w: 4 },
  { h: 4, id: 'notes', w: 4 },
  { h: 4, id: 'todo', w: 4 },
  { h: 3, id: 'pomodoro', w: 6 },
  { h: 3, id: 'events-today', w: 6 },
] as const;

export function createDefaultDocument(): BoardDocument {
  const widgets = seedLayout.flatMap((seed) => {
    const definition = findWidget(seed.id);
    if (!definition) {
      return [];
    }
    return [
      {
        c: defaultConfig(definition),
        d: definition.id,
        h: Math.min(
          Math.max(seed.h, definition.minSize.h),
          definition.maxSize.h,
        ),
        i: newId('w'),
        w: Math.min(
          Math.max(seed.w, definition.minSize.w),
          definition.maxSize.w,
        ),
      },
    ];
  });
  return {
    activeId: 'd_main',
    dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets }],
    updatedAt: nowStamp(),
    v: DOCUMENT_VERSION,
  };
}

export function activeDashboard(
  document: BoardDocument,
): DashboardDefinition {
  return (
    document.dashboards.find(
      (dashboard) => dashboard.id === document.activeId,
    ) ?? document.dashboards[0]!
  );
}

function bounded(
  original: BoardDocument,
  next: BoardDocument,
): BoardDocument {
  return documentByteLength(next) <= MAX_DOCUMENT_BYTES ? next : original;
}

function updateActive(
  document: BoardDocument,
  update: (dashboard: DashboardDefinition) => DashboardDefinition,
): BoardDocument {
  const dashboards = document.dashboards.map((dashboard) =>
    dashboard.id === document.activeId ? update(dashboard) : dashboard,
  );
  if (
    dashboards.every(
      (dashboard, index) => dashboard === document.dashboards[index],
    )
  ) {
    return document;
  }
  return bounded(document, {
    ...document,
    dashboards,
    updatedAt: nowStamp(),
  });
}

export function addDashboard(
  document: BoardDocument,
  rawName: string,
  idFactory: () => string = () => newId('d'),
): BoardDocument {
  if (document.dashboards.length >= MAX_DASHBOARDS) {
    return document;
  }
  const name = rawName.trim().slice(0, 40);
  if (!name) {
    return document;
  }
  const id = idFactory().slice(0, 40);
  if (
    !id ||
    document.dashboards.some((dashboard) => dashboard.id === id)
  ) {
    return document;
  }
  const dashboard = { id, name, widgets: [] };
  return bounded(document, {
    ...document,
    activeId: id,
    dashboards: [...document.dashboards, dashboard],
    updatedAt: nowStamp(),
  });
}

export function renameDashboard(
  document: BoardDocument,
  id: string,
  rawName: string,
): BoardDocument {
  const name = rawName.trim().slice(0, 40);
  if (!name) {
    return document;
  }
  const target = document.dashboards.find((dashboard) => dashboard.id === id);
  if (!target || target.name === name) {
    return document;
  }
  return bounded(document, {
    ...document,
    dashboards: document.dashboards.map((dashboard) =>
      dashboard.id === id ? { ...dashboard, name } : dashboard,
    ),
    updatedAt: nowStamp(),
  });
}

export function selectDashboard(
  document: BoardDocument,
  id: string,
): BoardDocument {
  if (
    id === document.activeId ||
    !document.dashboards.some((dashboard) => dashboard.id === id)
  ) {
    return document;
  }
  return {
    ...document,
    activeId: id,
    updatedAt: nowStamp(),
  };
}

export function removeDashboard(
  document: BoardDocument,
  id: string,
): BoardDocument {
  if (
    document.dashboards.length <= 1 ||
    !document.dashboards.some((dashboard) => dashboard.id === id)
  ) {
    return document;
  }
  const dashboards = document.dashboards.filter(
    (dashboard) => dashboard.id !== id,
  );
  return {
    ...document,
    activeId: dashboards.some(
      (dashboard) => dashboard.id === document.activeId,
    )
      ? document.activeId
      : dashboards[0]!.id,
    dashboards,
    updatedAt: nowStamp(),
  };
}

export function addWidget(
  document: BoardDocument,
  definition: WidgetDefinition,
  idFactory: () => string = () => newId('w'),
): BoardDocument {
  const dashboard = activeDashboard(document);
  if (
    dashboard.widgets.length >= MAX_WIDGETS ||
    (!definition.multiple &&
      dashboard.widgets.some((widget) => widget.d === definition.id))
  ) {
    return document;
  }
  const id = idFactory().slice(0, 40);
  if (
    !id ||
    document.dashboards.some((item) =>
      item.widgets.some((widget) => widget.i === id),
    )
  ) {
    return document;
  }
  const widget: WidgetInstance = {
    c: defaultConfig(definition),
    d: definition.id,
    h: definition.defaultSize.h,
    i: id,
    w: definition.defaultSize.w,
  };
  return updateActive(document, (item) => ({
    ...item,
    widgets: [...item.widgets, widget],
  }));
}

export function removeWidget(
  document: BoardDocument,
  instanceId: string,
): BoardDocument {
  return updateActive(document, (dashboard) => {
    const widgets = dashboard.widgets.filter(
      (widget) => widget.i !== instanceId,
    );
    return widgets.length === dashboard.widgets.length
      ? dashboard
      : { ...dashboard, widgets };
  });
}

export function moveWidget(
  document: BoardDocument,
  fromId: string,
  toId: string,
): BoardDocument {
  return updateActive(document, (dashboard) => {
    const from = dashboard.widgets.findIndex((widget) => widget.i === fromId);
    const to = dashboard.widgets.findIndex((widget) => widget.i === toId);
    if (from < 0 || to < 0 || from === to) {
      return dashboard;
    }
    const widgets = [...dashboard.widgets];
    const [moved] = widgets.splice(from, 1);
    widgets.splice(to, 0, moved!);
    return { ...dashboard, widgets };
  });
}

export function resizeWidget(
  document: BoardDocument,
  instanceId: string,
  size: WidgetSize,
): BoardDocument {
  return updateActive(document, (dashboard) => {
    const current = dashboard.widgets.find(
      (widget) => widget.i === instanceId,
    );
    if (!current) {
      return dashboard;
    }
    const definition = findWidget(current.d);
    const minW = definition?.minSize.w ?? 1;
    const maxW = definition?.maxSize.w ?? 12;
    const minH = definition?.minSize.h ?? 1;
    const maxH = definition?.maxSize.h ?? 8;
    const next = {
      h: Math.min(maxH, Math.max(minH, Math.round(size.h))),
      w: Math.min(maxW, Math.max(minW, Math.round(size.w))),
    };
    if (next.h === current.h && next.w === current.w) {
      return dashboard;
    }
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) =>
        widget.i === instanceId ? { ...widget, ...next } : widget,
      ),
    };
  });
}

export function updateWidgetConfig(
  document: BoardDocument,
  instanceId: string,
  patch: Record<string, unknown>,
): BoardDocument {
  return updateActive(document, (dashboard) => {
    if (!dashboard.widgets.some((widget) => widget.i === instanceId)) {
      return dashboard;
    }
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) =>
        widget.i === instanceId
          ? { ...widget, c: { ...widget.c, ...patch } }
          : widget,
      ),
    };
  });
}

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/layout.ts (189 lines)
  confidence: high
  todos:      0
  notes:      The native Board model preserves layout normalization, migrations, dashboard edits, and widget mutations.
*/
