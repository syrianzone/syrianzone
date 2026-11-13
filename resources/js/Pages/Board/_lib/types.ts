import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';

// ***** the persisted layout format *****
// These five key names (`v`, `i`, `d`, `w`, `h`, `c`) and every widget definition
// id are permanent once a user has saved a board. Nothing derived is stored:
// no titles, no icons, no cached data, no per-breakpoint copies.

export interface WidgetInstance {
  i: string;                       // instance id, unique within the document
  d: string;                       // widget definition id
  w: number;                       // columns of 12
  h: number;                       // row units
  c: Record<string, unknown>;      // widget config, opaque to the server
}

export interface DashboardDef {
  id: string;
  name: string;
  widgets: WidgetInstance[];
}

export interface BoardDoc {
  v: number;                       // the only migration lever
  activeId: string;
  updatedAt: string;               // iso8601, drives last-write-wins on login
  dashboards: DashboardDef[];
}

// The grid caps, as a stored width and height may not exceed them.
export const GRID_COLS = 12;
export const GRID_ROWS = 8;

// ***** the widget contract *****

export type Breakpoint = 'sm' | 'md' | 'lg';
export type Capability = 'auth' | 'geo';

// The gallery's sections, in display order. This is the only place a category
// exists, so a widget cannot declare one the gallery would not render.
export const CATEGORIES = [
  { id: 'time', label: 'الوقت والعبادات' },
  { id: 'personal', label: 'الإنتاجية والشخصي' },
  { id: 'community', label: 'المجتمع والأخبار' },
  { id: 'places', label: 'الأماكن والمواصلات' },
  { id: 'food', label: 'المطبخ والمأكولات' },
] as const;

export type WidgetCategory = (typeof CATEGORIES)[number]['id'];

// Declarative config schema, so WidgetConfigDialog renders any widget's settings
// generically and adding a configurable widget needs zero core changes.
export type ConfigField =
  | { key: string; type: 'text'; label: string; default: string; maxLength?: number }
  | { key: string; type: 'number'; label: string; default: number; min?: number; max?: number }
  | { key: string; type: 'switch'; label: string; default: boolean }
  | { key: string; type: 'select'; label: string; default: string; options: { value: string; label: string }[] };

export interface WidgetSize { w: number; h: number }

export interface WidgetProps<C = Record<string, unknown>> {
  instanceId: string;
  config: C;
  span: number;                    // resolved column span at the current breakpoint
  breakpoint: Breakpoint;
  editing: boolean;
  onConfigChange: (patch: Partial<C>) => void;
}

/**
 * Where a widget sits in the board a new visitor starts with, and how big it is
 * there. The order is the document's array order: in RTL the first item lands on
 * the right, so one order is one visual row.
 */
export interface SeedPlacement {
  order: number;
  w: number;
  h: number;
}

/**
 * Everything the board needs to know about a widget, declared by the widget's
 * own `_widgets/<id>/index.ts`. The registry reads these declarations, so adding
 * a widget is a new folder and nothing else.
 *
 * The View is attached by the registry, from the folder's `View.tsx`, so this
 * file stays free of the widget's code and the declaration never imports the
 * View it describes.
 */
export interface WidgetDeclaration {
  id: string;                      // stable ascii, equals the folder name, written into the document
  name: string;
  description: string;
  icon: LucideIcon;
  category: WidgetCategory;
  defaultSize: WidgetSize;
  minSize: WidgetSize;
  maxSize: WidgetSize;
  fields: ConfigField[];           // [] means not configurable
  requires: Capability[];          // enforced by BoardTile, never inside a widget
  refresh: { staleMs: number; intervalMs: number | null };
  multiple: boolean;               // may appear more than once on one board
  seed: SeedPlacement | null;      // null: in the gallery, not on the seeded board
  source: WidgetSource | null;     // null: reads nothing outside the document
}

/** A read in `_lib/sources.ts`: the fetcher a widget's queries go through. */
export type WidgetSource = (...args: never[]) => Promise<unknown>;

export interface WidgetDefinition<C = Record<string, unknown>> extends WidgetDeclaration {
  Component: LazyExoticComponent<ComponentType<WidgetProps<C>>>;
}
