import { lazy, type ComponentType } from 'react';
import { clampSize, defaultConfig, newId, nowStamp } from './doc';
import type {
  BoardDoc,
  WidgetDeclaration,
  WidgetDefinition,
  WidgetProps,
  WidgetSource,
} from './types';
import { CATEGORIES } from './types';

// The one registration point. Every folder under `_widgets/` that exports a
// declaration from its `index.ts` is a widget: the gallery, the seeded board,
// the category sections and the source table below are all derived from those
// files, so adding a widget is one new folder and no edit here.
const declarations = import.meta.glob<{ default: WidgetDeclaration }>('../_widgets/*/index.ts', {
  eager: true,
});

// The declarations are eager and tiny; the Views stay behind their own chunk and
// are loaded the first time a tile renders.
const views = import.meta.glob<{ default: ComponentType<WidgetProps<Record<string, unknown>>> }>(
  '../_widgets/*/View.tsx',
);

/**
 * The registry is heterogeneous: every View declares its own config shape, while
 * the document's `c` is the only config the grid has at runtime. Erasing the
 * parameter here is what lets one list hold all of them; this is the one place
 * the erasure happens.
 */
type RegisteredWidget = WidgetDefinition<any>;

function folderOf(modulePath: string): string {
  return modulePath.split('/').at(-2) ?? '';
}

function buildWidgets(): RegisteredWidget[] {
  const built = Object.entries(declarations).map(([modulePath, module]) => {
    const folder = folderOf(modulePath);
    const declaration = module.default;
    if (!declaration) {
      throw new Error(`Board widget ${modulePath} has no default export.`);
    }
    if (declaration.id !== folder) {
      throw new Error(`Board widget id "${declaration.id}" must match its folder "_widgets/${folder}".`);
    }
    const loadView = views[`../_widgets/${folder}/View.tsx`];
    if (!loadView) {
      throw new Error(`Board widget ${folder} has no View.tsx.`);
    }
    return { ...declaration, Component: lazy(loadView) };
  });

  const categoryOrder = CATEGORIES.map((category) => category.id as string);
  const position = (def: WidgetDeclaration): number => def.seed?.order ?? Number.MAX_SAFE_INTEGER;

  return built.sort((a, b) => {
    const byCategory = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    if (byCategory !== 0) return byCategory;
    // Seeded widgets keep their board order in the gallery; the rest follow
    // alphabetically, so the list never depends on file-system order.
    return position(a) - position(b) || a.id.localeCompare(b.id);
  });
}

export const WIDGETS = buildWidgets();

const WIDGETS_BY_ID: Record<string, RegisteredWidget> = Object.fromEntries(
  WIDGETS.map((w) => [w.id, w]),
);

export function findWidget(id: string): RegisteredWidget | undefined {
  return WIDGETS_BY_ID[id];
}

/**
 * Which read each widget uses, derived from its declaration. A widget with no
 * `source` reads nothing outside the document (a clock, a note, a timer).
 */
export const WIDGET_SOURCES: { id: string; source: WidgetSource }[] = WIDGETS.flatMap(
  (def) => (def.source === null ? [] : [{ id: def.id, source: def.source }]),
);

// The default board, in the order each declaration asks for. Array order is grid
// order, and in RTL the first item lands on the RIGHT, so each row reads right to
// left: the row rendered as clock | prayer | weather on screen is stored
// weather, prayer, clock. Sizes are clamped to the widget's own bounds, so a
// declaration can never seed a size it does not allow.
export function defaultDoc(): BoardDoc {
  const widgets = WIDGETS
    .filter((def) => def.seed !== null)
    .sort((a, b) => (a.seed?.order ?? 0) - (b.seed?.order ?? 0))
    .map((def) => {
      const seed = def.seed ?? { w: def.defaultSize.w, h: def.defaultSize.h };
      const size = clampSize(seed, def);
      return { i: newId('w'), d: def.id, w: size.w, h: size.h, c: defaultConfig(def) };
    });

  return {
    v: 1,
    activeId: 'd_main',
    updatedAt: nowStamp(),
    dashboards: [{ id: 'd_main', name: 'الرئيسية', widgets }],
  };
}

export const GALLERY_CATEGORIES = CATEGORIES.filter(
  (category) => WIDGETS.some((def) => def.category === category.id),
);
