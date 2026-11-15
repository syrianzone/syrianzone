import { array, integer, record, text } from '../../platform/validation';

export type Sort = 'name' | 'email' | 'role' | 'is_banned' | 'created_at' | 'deleted_at';
export type Trashed = 'without' | 'with' | 'only';
export type BulkAction = 'delete' | 'restore' | 'force-delete';
export interface Options {
  actorId: number;
  defaultRole: string;
  roles: { value: string; label: string; canBeBanned: boolean }[];
  groups: { id: string; label: string; icon: string; permissions: { id: string; label: string }[] }[];
  cities: { id: string; name: string }[];
  perPageMax: number;
  bulkMax: number;
  sorts: Sort[];
}
export interface UserRecord {
  id: number;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  permissions: string[];
  effectivePermissions: string[];
  scopes: Record<string, unknown>;
  scope: string[];
  createdAt: string | null;
  deletedAt: string | null;
  version: string;
  isSelf: boolean;
  actions: { edit: boolean; remove: boolean; restore: boolean; forceDelete: boolean; changeBan: boolean };
}
export interface UserForm {
  id: number | null;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  password: string;
  permissions: string[];
  scope: string[];
  version: string | null;
  allowedLegacyScope: string[];
}
export interface UserPage {
  items: UserRecord[];
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
}
export interface UserQuery {
  query: string;
  sort: Sort;
  direction: 'asc' | 'desc';
  trashed: Trashed;
  page: number;
  perPage: number;
}
export const SORT_LABELS: Record<Sort, string> = {
  name: 'الاسم',
  email: 'البريد الإلكتروني',
  role: 'الدور',
  is_banned: 'الحظر',
  created_at: 'تاريخ الإنشاء',
  deleted_at: 'تاريخ الحذف'
};
export const ACTION_LABELS: Record<BulkAction, string> = { delete: 'حذف مؤقت', restore: 'استعادة', 'force-delete': 'حذف نهائي' };
export function userTarget(params: Readonly<Record<string, string>>): number | 'create' | null {
  if (params.create === '1') return 'create';
  const value = params.edit;
  return value && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
}
function positive(value: unknown): number {
  const result = integer(value);
  if (result < 1) throw new Error('معرّف المستخدم غير صالح.');
  return result;
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('قيمة صلاحية المستخدم غير صالحة.');
  return value;
}
function version(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error('نسخة سجل المستخدم غير صالحة.');
  return result;
}
function date(value: unknown): string | null {
  if (value == null) return null;
  const result = text(value);
  if (!Number.isFinite(Date.parse(result))) throw new Error('تاريخ المستخدم غير صالح.');
  return result;
}
const strings = (value: unknown): string[] => array(value).map((item) => text(item));
export function decodeOptions(value: unknown): Options {
  const row = record(value),
    limits = record(row.limits);
  if (row.can_manage_users !== true) throw new Error('لا تملك صلاحية إدارة المستخدمين.');
  const sorts = strings(row.sort_columns);
  if (sorts.some((item) => !(item in SORT_LABELS))) throw new Error('خيارات ترتيب المستخدمين غير صالحة.');
  return {
    actorId: positive(row.actor_id),
    defaultRole: text(row.default_role),
    roles: array(row.roles).map((item) => {
      const role = record(item);
      return { value: text(role.value), label: text(role.label), canBeBanned: bool(role.can_be_banned) };
    }),
    groups: array(row.groups).map((item) => {
      const group = record(item);
      return {
        id: text(group.id),
        label: text(group.label),
        icon: text(group.icon),
        permissions: array(group.permissions).map((entry) => {
          const permission = record(entry);
          return { id: text(permission.id), label: text(permission.label) };
        })
      };
    }),
    cities: array(row.cities).map((item) => {
      const city = record(item);
      return { id: text(city.id), name: text(city.name_ar) };
    }),
    perPageMax: positive(limits.per_page_max),
    bulkMax: positive(limits.bulk_max),
    sorts: sorts as Sort[]
  };
}
export function decodeUser(value: unknown): UserRecord {
  const row = record(value),
    actions = record(row.actions);
  return {
    id: positive(row.id),
    name: text(row.name),
    email: text(row.email),
    role: text(row.role),
    banned: bool(row.is_banned),
    permissions: strings(row.permissions),
    effectivePermissions: strings(row.effective_permissions),
    scopes: record(row.permission_scopes),
    scope: strings(row.stored_transit_scope),
    createdAt: date(row.created_at),
    deletedAt: date(row.deleted_at),
    version: version(row.version),
    isSelf: bool(row.is_self),
    actions: {
      edit: bool(actions.edit),
      remove: bool(actions.delete),
      restore: bool(actions.restore),
      forceDelete: bool(actions.force_delete),
      changeBan: bool(actions.change_ban)
    }
  };
}
export function decodeUserPage(value: unknown): UserPage {
  const row = record(value),
    currentPage = positive(row.current_page),
    lastPage = positive(row.last_page),
    total = integer(row.total);
  const items = array(row.data).map(decodeUser);
  if (total < 0 || (currentPage > lastPage && items.length > 0)) throw new Error('صفحة المستخدمين غير صالحة.');
  return { items, currentPage, lastPage, total, perPage: positive(row.per_page) };
}
export function initialForm(user: UserRecord | null, options: Options): UserForm {
  const known = new Set(options.groups.flatMap((group) => group.permissions.map((permission) => permission.id)));
  return {
    id: user?.id ?? null,
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user ? (options.roles.some((role) => role.value === user.role) ? user.role : '') : options.defaultRole,
    banned: user?.banned ?? false,
    password: '',
    permissions: user?.permissions.filter((permission) => known.has(permission)) ?? [],
    scope: [...(user?.scope ?? [])],
    version: user?.version ?? null,
    allowedLegacyScope: [...(user?.scope ?? [])]
  };
}
export function userPayload(form: UserForm, options: Options, creating: boolean) {
  const name = form.name.trim(),
    email = form.email.trim(),
    known = new Set(options.groups.flatMap((group) => group.permissions.map((permission) => permission.id)));
  if (!name || [...name].length > 255 || email.length > 255 || !/^[^\s@]+@[^\s@]+$/.test(email))
    throw new Error('أدخل اسماً وبريداً إلكترونياً صالحين حتى 255 حرفاً.');
  if (!options.roles.some((role) => role.value === form.role) || form.permissions.some((permission) => !known.has(permission)))
    throw new Error('اختر دوراً وصلاحيات من القائمة المتاحة.');
  if (form.scope.some((city) => !options.cities.some((option) => option.id === city) && !form.allowedLegacyScope.includes(city)))
    throw new Error('اختر محافظة من القائمة المتاحة.');
  const hasPassword = form.password.replace(/^[\u0000\t\n\v\r ]+|[\u0000\t\n\v\r ]+$/g, '').length > 0;
  if ((creating && !hasPassword) || form.password.length > 255) throw new Error('أدخل كلمة مرور للمستخدم الجديد، حتى 255 حرفاً.');
  return {
    name,
    email,
    role: form.role,
    is_banned: form.banned,
    permissions: [...new Set(form.permissions)],
    transit_scope: form.permissions.some((permission) => permission.startsWith('transit.')) ? [...new Set(form.scope)] : [],
    ...(hasPassword ? { password: form.password } : {}),
    ...(creating ? {} : { version: version(form.version) })
  };
}
export function bulkPayload(action: BulkAction, users: readonly UserRecord[], maximum: number) {
  const ids = users.map((user) => user.id);
  if (!ids.length || ids.length > maximum || new Set(ids).size !== ids.length)
    throw new Error(`اختر من مستخدم واحد إلى ${maximum} مستخدماً مختلفاً.`);
  return { action, ids, versions: Object.fromEntries(users.map((user) => [positive(user.id), version(user.version)])) };
}
export function bulkBatches(users: readonly UserRecord[], maximum: number): UserRecord[][] {
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1 ||
    !users.length ||
    new Set(users.map((user) => user.id)).size !== users.length ||
    users.filter((user) => user.isSelf).length > 1
  )
    throw new Error('قائمة المستخدمين المحددين غير صالحة.');
  const ordered = [...users.filter((user) => !user.isSelf), ...users.filter((user) => user.isSelf)],
    batches: UserRecord[][] = [];
  for (let offset = 0; offset < ordered.length; offset += maximum) batches.push(ordered.slice(offset, offset + maximum));
  return batches;
}
// PORT STATUS: source Filament UserResource.php forms/table; confidence medium; todos 1 controlled-account native CRUD and destructive confirmation verification.
