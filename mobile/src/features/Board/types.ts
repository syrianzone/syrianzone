import type { LucideIcon } from 'lucide-react-native';

export interface WidgetInstance {
  c: Record<string, unknown>;
  d: string;
  h: number;
  i: string;
  w: number;
}

export interface DashboardDefinition {
  id: string;
  name: string;
  widgets: WidgetInstance[];
}

export interface BoardDocument {
  activeId: string;
  dashboards: DashboardDefinition[];
  updatedAt: string;
  v: number;
}

export type WidgetCategory =
  | 'community'
  | 'food'
  | 'personal'
  | 'places'
  | 'time'
  | 'transit';

export type WidgetCapability = 'auth' | 'geo';

export type WidgetConfigField =
  | {
      default: boolean;
      key: string;
      labelAr: string;
      labelEn: string;
      type: 'switch';
    }
  | {
      default: number;
      key: string;
      labelAr: string;
      labelEn: string;
      max?: number;
      min?: number;
      type: 'number';
    }
  | {
      default: string;
      key: string;
      labelAr: string;
      labelEn: string;
      maxLength?: number;
      type: 'text';
    }
  | {
      default: string;
      key: string;
      labelAr: string;
      labelEn: string;
      options: readonly {
        labelAr: string;
        labelEn: string;
        value: string;
      }[];
      type: 'select';
    };

export interface WidgetSize {
  h: number;
  w: number;
}

export interface WidgetDefinition {
  category: WidgetCategory;
  defaultSize: WidgetSize;
  descriptionAr: string;
  descriptionEn: string;
  fields: readonly WidgetConfigField[];
  icon: LucideIcon;
  id: string;
  maxSize: WidgetSize;
  minSize: WidgetSize;
  multiple: boolean;
  nameAr: string;
  nameEn: string;
  refresh: {
    intervalMs: number | null;
    staleMs: number;
  };
  requires: readonly WidgetCapability[];
}

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/types.ts (78 lines)
  confidence: high
  todos:      0
  notes:      Native Board types preserve dashboard, layout, widget, capability, configuration, and refresh contracts.
*/
