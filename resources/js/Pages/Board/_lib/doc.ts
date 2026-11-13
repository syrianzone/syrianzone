import type { WidgetDeclaration, WidgetSize } from './types';
import { GRID_COLS, GRID_ROWS } from './types';

// The document's building blocks, kept apart from the reducer so the widget
// registry can seed a document without importing — and depending on — it.

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowStamp(): string {
  return new Date().toISOString();
}

export function defaultConfig(def: WidgetDeclaration): Record<string, unknown> {
  return Object.fromEntries(def.fields.map((f) => [f.key, f.default]));
}

// Resize is discrete and bounded by the widget's own min/max. The reducer, the
// seed and the size menu all go through here, so a stored size and an offered
// size cannot disagree.

/** The widths and heights the size menu offers, before a widget's bounds apply. */
const WIDTH_STEPS = [2, 3, 4, 6, 8, GRID_COLS];
const HEIGHT_STEPS = [1, 2, 3, 4, 6, GRID_ROWS];

type SizeBounds = Pick<WidgetDeclaration, 'minSize' | 'maxSize'>;

/**
 * The only place a size becomes a stored size: clamped to the grid's own caps
 * and to the widget's declared bounds. A widget the registry does not know (a
 * document from a newer client) keeps its size within the grid's caps only.
 */
export function clampSize(size: WidgetSize, def?: SizeBounds): WidgetSize {
  const minW = def ? Math.max(1, def.minSize.w) : 1;
  const maxW = Math.min(GRID_COLS, def ? def.maxSize.w : GRID_COLS);
  const minH = def ? Math.max(1, def.minSize.h) : 1;
  const maxH = Math.min(GRID_ROWS, def ? def.maxSize.h : GRID_ROWS);

  return {
    w: Math.min(Math.max(Math.round(size.w), minW), Math.max(minW, maxW)),
    h: Math.min(Math.max(Math.round(size.h), minH), Math.max(minH, maxH)),
  };
}

export function allowedSizes(def: SizeBounds): { widths: number[]; heights: number[] } {
  return {
    widths: WIDTH_STEPS.filter((w) => w >= def.minSize.w && w <= def.maxSize.w),
    heights: HEIGHT_STEPS.filter((h) => h >= def.minSize.h && h <= def.maxSize.h),
  };
}
