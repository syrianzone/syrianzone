import { array, assetUrl, integer, record, text } from './validation';

export interface AccountUser {
  id: number; name: string; email: string; role: string; avatar_url: string | null;
  effective_permissions: readonly string[]; settings: Record<string, unknown>;
  transit_scope: readonly string[] | null;
}
export function decodeAccountUser(value: unknown): AccountUser {
  const row = record(value);
  if (row.is_banned === true) throw new Error('تم حظر هذا الحساب.');
  const id = integer(row.id);
  if (id < 1) throw new Error('بيانات الحساب غير صالحة.');
  return { id, name: text(row.name), email: text(row.email), role: text(row.role), avatar_url: assetUrl(row.avatar_url),
    effective_permissions: array(row.effective_permissions).map(permission => text(permission)), settings: row.settings == null || (Array.isArray(row.settings) && row.settings.length === 0) ? {} : record(row.settings),
    transit_scope: row.transit_scope === null ? null : array(row.transit_scope).map(scope => text(scope)) };
}
