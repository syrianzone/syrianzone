import { useState } from 'react';
import type { Draft, PublishedRoute, RouteForm } from './model';

interface DraftForm {
  color: number;
  rejecting: boolean;
  reason: string;
}
type Panel = 'edit' | 'move' | 'split' | 'delete' | null;
interface RouteToolForm {
  panel: Panel;
  targetCity: string;
  splitAt: string;
  form: RouteForm;
  names: [string, string, string, string];
}
export interface DraftEditor {
  state: DraftForm;
  update(patch: Partial<DraftForm>): void;
}
export interface RouteEditor {
  state: RouteToolForm;
  update(patch: Partial<RouteToolForm>): void;
}

// The screen owns these forms because AdaptivePanes reparents its detail subtree.
export function useTransitEditors() {
  const [drafts, setDrafts] = useState<Record<number, DraftForm>>({});
  const [routes, setRoutes] = useState<Record<string, RouteToolForm>>({});
  return {
    draft(draft: Pick<Draft, 'id' | 'color'>): DraftEditor {
      const initial = { color: draft.color, rejecting: false, reason: '' };
      return {
        state: drafts[draft.id] ?? initial,
        update: (patch) => setDrafts((previous) => ({ ...previous, [draft.id]: { ...(previous[draft.id] ?? initial), ...patch } }))
      };
    },
    route(route: Pick<PublishedRoute, 'id' | 'cityId' | 'name' | 'nameEn' | 'price' | 'color'>): RouteEditor {
      const initial: RouteToolForm = {
        panel: null,
        targetCity: route.cityId,
        splitAt: '',
        form: { nameAr: route.name, nameEn: route.nameEn ?? '', price: route.price == null ? '' : String(route.price), color: route.color },
        names: [
          `${route.name} (القسم الأول)`,
          route.nameEn ? `${route.nameEn} (Part 1)` : '',
          `${route.name} (القسم الثاني)`,
          route.nameEn ? `${route.nameEn} (Part 2)` : ''
        ]
      };
      return {
        state: routes[route.id] ?? initial,
        update: (patch) => setRoutes((previous) => ({ ...previous, [route.id]: { ...(previous[route.id] ?? initial), ...patch } }))
      };
    }
  };
}
// PORT STATUS: native pane ownership adapter; confidence high; todos 0.
