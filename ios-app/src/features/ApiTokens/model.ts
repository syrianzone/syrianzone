import { array, integer, record, text } from '../../platform/validation';
export interface TokenOwner {
  id: number;
  name: string;
  role: string;
}
export interface TokenRow {
  id: number;
  name: string;
  abilities: string[];
  owner: TokenOwner | null;
  ownerBanned: boolean;
  lastUsed: string | null;
  expires: string | null;
  expired: boolean;
  created: string | null;
}
export interface TokenPage {
  selfService: boolean;
  tokens: TokenRow[];
  owners: TokenOwner[];
  capabilityGroups: Record<string, { label: string; icon: string }>;
  capabilities: Record<string, Record<string, string>>;
  ttlOptions: { value: string; label: string }[];
  endpoint: string;
}
export interface IssuedToken {
  token: string;
  message: string;
  abilities: string[];
  dropped: string[];
  expires: string | null;
}
function nullable(value: unknown): string | null {
  return value == null ? null : text(value);
}
function owner(value: unknown): TokenOwner {
  const row = record(value);
  return { id: integer(row.id), name: text(row.name), role: text(row.role) };
}
export function decodeTokenPage(value: unknown): TokenPage {
  const row = record(value);
  if (typeof row.selfService !== 'boolean') throw new Error('إعدادات إدارة الرموز غير صالحة.');
  const capabilities: TokenPage['capabilities'] = {},
    groups: TokenPage['capabilityGroups'] = {};
  for (const [key, raw] of Object.entries(record(row.capabilities))) {
    const permissions: Record<string, string> = {};
    for (const [permission, label] of Object.entries(record(raw))) {
      if (!/^[a-z_]+\.[a-z_]+$/.test(permission)) throw new Error('قائمة صلاحيات الوكلاء غير صالحة.');
      permissions[permission] = text(label);
    }
    capabilities[key] = permissions;
  }
  for (const [key, raw] of Object.entries(record(row.capabilityGroups))) {
    const group = record(raw);
    groups[key] = { label: text(group.label), icon: text(group.icon, '') };
  }
  const endpoint = new URL(text(row.endpoint));
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password)
    throw new Error('عنوان واجهة الوكلاء غير صالح.');
  return {
    selfService: row.selfService,
    endpoint: endpoint.toString(),
    capabilities,
    capabilityGroups: groups,
    owners: array(row.owners).map(owner),
    ttlOptions: array(row.ttlOptions).map((raw) => {
      const option = record(raw);
      return { value: text(option.value), label: text(option.label) };
    }),
    tokens: array(row.tokens).map((raw) => {
      const token = record(raw);
      return {
        id: integer(token.id),
        name: text(token.name),
        abilities: array(token.abilities ?? []).map((ability) => text(ability)),
        owner: token.owner == null ? null : owner(token.owner),
        ownerBanned: token.owner_banned === true,
        lastUsed: nullable(token.last_used_at),
        expires: nullable(token.expires_at),
        expired: token.is_expired === true,
        created: nullable(token.created_at),
      };
    }),
  };
}
export function decodeIssued(value: unknown): IssuedToken {
  const row = record(value),
    token = text(row.plain_text_token);
  if (!token || token.length > 4096 || /[\r\n]/.test(token)) throw new Error('لم يتم تأكيد إصدار الرمز.');
  return {
    token,
    message: text(row.message),
    abilities: array(row.abilities ?? []).map((ability) => text(ability)),
    dropped: array(row.dropped ?? []).map((ability) => text(ability)),
    expires: nullable(row.expires_at),
  };
}
export function tokenBoundary(generation: number, permissions: readonly string[]): string {
  return JSON.stringify([generation, [...permissions].sort()]);
}
export function issuePayload(
  page: TokenPage,
  ownerId: string,
  name: string,
  ttl: string,
  selected: readonly string[],
): { user_id: number; name: string; ttl: string; permissions: string[] } {
  const selectedOwner = page.owners.find((item) => String(item.id) === ownerId),
    permissions = [...new Set(selected)],
    offered = new Set(Object.values(page.capabilities).flatMap((group) => Object.keys(group)));
  if (
    !selectedOwner ||
    (page.selfService && selectedOwner.id !== page.owners[0]?.id) ||
    !name.trim() ||
    name.trim().length > 255 ||
    !page.ttlOptions.some((option) => option.value === ttl) ||
    !permissions.length ||
    permissions.some((permission) => !offered.has(permission))
  )
    throw new Error('اختر المستخدم ومدة الصلاحية، وسمّ الرمز، واختر صلاحية متاحة واحدة على الأقل.');
  return { user_id: selectedOwner.id, name: name.trim(), ttl, permissions };
}
