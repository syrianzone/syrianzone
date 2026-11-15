import { expect, test } from 'bun:test';
import { bulkBatches, bulkPayload, decodeOptions, decodeUser, decodeUserPage, initialForm, userPayload, userTarget } from './model';

const version = 'a'.repeat(64);
const options = {
  can_manage_users: true,
  actor_id: 1,
  default_role: 'user',
  roles: [
    { value: 'superadmin', label: 'مدير عام', can_be_banned: false },
    { value: 'user', label: 'مستخدم', can_be_banned: true }
  ],
  groups: [{ id: 'transit', label: 'ترانزيت', icon: 'transit', permissions: [{ id: 'transit.approve', label: 'الموافقة' }] }],
  cities: [{ id: 'damascus', name_ar: 'دمشق' }],
  limits: { per_page_max: 100, bulk_max: 500 },
  sort_columns: ['name', 'email', 'role', 'is_banned', 'created_at', 'deleted_at']
};
const user = {
  id: 2,
  name: 'اسم',
  email: 'local@example.test',
  role: 'user',
  is_banned: false,
  permissions: ['transit.approve', '*', 'future.permission'],
  effective_permissions: ['transit.approve'],
  permission_scopes: { places: ['unknown'], transit: ['damascus'] },
  stored_transit_scope: ['damascus'],
  transit_scope: ['damascus'],
  created_at: null,
  deleted_at: null,
  version,
  is_self: false,
  actions: { edit: true, delete: true, restore: false, force_delete: false, change_ban: true }
};

test('user editor reads server roles capabilities and action permissions without deriving role implications', () => {
  const decoded = decodeUser({ ...user, role: 'superadmin', effective_permissions: [] });
  expect(decoded.effectivePermissions).toEqual([]);
  expect(decoded.actions.changeBan).toBe(true);
  const policy = decodeOptions(options);
  expect(policy.actorId).toBe(1);
  expect(policy.roles[0]?.canBeBanned).toBe(false);
  expect(() => decodeOptions({ ...options, can_manage_users: false })).toThrow();
});
test('editing sends known checkbox choices while existing unknown capabilities stay server-owned', () => {
  const policy = decodeOptions(options),
    form = initialForm(decodeUser(user), policy),
    payload = userPayload(form, policy, false);
  expect(form.permissions).toEqual(['transit.approve']);
  expect(payload.permissions).toEqual(['transit.approve']);
  expect(payload.transit_scope).toEqual(['damascus']);
  expect(payload).not.toHaveProperty('password');
  expect(payload).not.toHaveProperty('permission_scopes');
  expect(payload.version).toBe(version);
});
test('password is required for creation and blank edits preserve the current server password', () => {
  const policy = decodeOptions(options),
    form = initialForm(null, policy);
  expect(() => userPayload({ ...form, name: 'جديد', email: 'new@example.test', role: 'user' }, policy, true)).toThrow();
  expect(userPayload({ ...form, name: ' جديد ', email: 'new@example.test ', role: 'user', password: 'secret-local' }, policy, true).password).toBe(
    'secret-local'
  );
  const edit = initialForm(decodeUser(user), policy);
  expect(userPayload({ ...edit, password: '' }, policy, false)).not.toHaveProperty('password');
  expect(userPayload({ ...edit, password: '   ' }, policy, false)).not.toHaveProperty('password');
  expect(() => userPayload({ ...form, name: 'جديد', email: 'new@example.test', password: '   ' }, policy, true)).toThrow();
  expect(userPayload({ ...edit, email: 'a@localhost' }, policy, false).email).toBe('a@localhost');
});
test('manual role capability and scope injection fail before dispatch', () => {
  const policy = decodeOptions(options),
    form = initialForm(decodeUser(user), policy);
  expect(() => userPayload({ ...form, role: 'admin' }, policy, false)).toThrow();
  expect(() => userPayload({ ...form, permissions: ['*'] }, policy, false)).toThrow();
  expect(() => userPayload({ ...form, scope: ['foreign-city'] }, policy, false)).toThrow();
  expect(userPayload({ ...form, permissions: [] }, policy, false).transit_scope).toEqual([]);
});
test('bulk confirmations bind exact selected versions and preserve source self-selection', () => {
  const first = decodeUser(user),
    self = decodeUser({ ...user, id: 1, is_self: true });
  expect(bulkPayload('delete', [first, self], 500)).toEqual({ action: 'delete', ids: [2, 1], versions: { 1: version, 2: version } });
  expect(() => bulkPayload('delete', [first, first], 500)).toThrow();
  expect(() => bulkPayload('restore', [], 500)).toThrow();
  expect(() => bulkPayload('force-delete', [first, self], 1)).toThrow();
});
test('private record decoding rejects malformed identities versions actions and timestamps', () => {
  expect(() => decodeUser({ ...user, id: -1 })).toThrow();
  expect(() => decodeUser({ ...user, version: 'old' })).toThrow();
  expect(() => decodeUser({ ...user, actions: { ...user.actions, edit: 'yes' } })).toThrow();
  expect(() => decodeUser({ ...user, deleted_at: 'not-a-date' })).toThrow();
});

test('bulk batches place the current account last without truncating a larger selection', () => {
  const first = decodeUser(user),
    self = decodeUser({ ...user, id: 1, is_self: true });
  expect(bulkBatches([self, first], 1).map((batch) => batch.map((record) => record.id))).toEqual([[2], [1]]);
  expect(() => bulkBatches([first, first], 1)).toThrow();
});
test('cold edit routes accept only safe positive user ids', () => {
  expect(userTarget({ edit: '2' })).toBe(2);
  expect(userTarget({ create: '1' })).toBe('create');
  for (const edit of ['0', '-1', '9007199254740992', '2abc']) expect(userTarget({ edit })).toBeNull();
});
test('a deleted last page can be clamped to the current Laravel page count', () => {
  expect(decodeUserPage({ data: [], current_page: 3, last_page: 2, total: 30, per_page: 25 }).lastPage).toBe(2);
});
