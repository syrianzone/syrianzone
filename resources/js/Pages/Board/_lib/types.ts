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

// ***** the widget contract *****

export type Breakpoint = 'sm' | 'md' | 'lg';
export type WidgetCategory = 'places' | 'transit' | 'time' | 'personal' | 'community' | 'food';
export type Capability = 'auth' | 'geo';

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

export interface WidgetDefinition<C = Record<string, unknown>> {
  id: string;                      // stable ascii, written into the document, never renamed
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
  Component: LazyExoticComponent<ComponentType<WidgetProps<C>>>;
}

export const CATEGORY_LABELS: Record<WidgetCategory, string> = {
  places: 'الأماكن',
  transit: 'المواصلات',
  time: 'الوقت والطقس',
  personal: 'شخصي',
  community: 'المجتمع',
  food: 'المطبخ',
};
