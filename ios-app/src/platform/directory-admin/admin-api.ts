import { api, type ApiClient } from '../../api';
import { adminAck, adminId, type AdminDefinition, type AdminKind } from './admin-contract';

export function createDirectoryAdminClient(definition: AdminDefinition, generation: number, client: Pick<ApiClient, 'request' | 'page'> = api) {
  const base = `admin/${definition.key}`;
  const path = (kind: AdminKind) => {
    if (kind === 'categories' && !definition.categories) throw new Error('هذا الدليل لا يستخدم فئات.');
    const segment = kind === 'categories' ? 'categories' : definition.itemPath;
    return `${base}${segment ? `/${segment}` : ''}`;
  };
  return {
    page: (signal: AbortSignal) => client.page(`/admin/${definition.key}`, definition.component, definition.decode, { authenticated: true, sessionGeneration: generation, signal }),
    save: (kind: AdminKind, id: string | null, body: unknown) => client.request(`${path(kind)}${id === null ? '' : `/${encodeURIComponent(adminId(id))}`}`, adminAck, { method: kind === 'categories' && id !== null ? 'PUT' : 'POST', authenticated: true, sessionGeneration: generation, body }),
    remove: (kind: AdminKind, id: string) => client.request(`${path(kind)}/${encodeURIComponent(adminId(id))}`, adminAck, { method: 'DELETE', authenticated: true, sessionGeneration: generation }),
    toggle: (id: string) => {
      if (!definition.toggle) throw new Error('تغيير الظهور المباشر غير متاح لهذا الدليل.');
      return client.request(`${path('items')}/${encodeURIComponent(adminId(id))}/toggle`, adminAck, { method: 'PATCH', authenticated: true, sessionGeneration: generation });
    },
    reorder: (kind: AdminKind, orders: readonly { id: string; order_column: number }[]) => {
      if (!definition.reorder || !orders.length || new Set(orders.map(row => row.id)).size !== orders.length || orders.some(row => !Number.isInteger(row.order_column))) throw new Error('ترتيب الدليل غير صالح.');
      return client.request(`${path(kind)}/reorder`, adminAck, { method: 'POST', authenticated: true, sessionGeneration: generation, body: { orders } });
    }
  };
}
