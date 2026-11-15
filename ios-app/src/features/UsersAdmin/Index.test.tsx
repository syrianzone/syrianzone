import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { api } from '../../api';
import { mockNativeHosts, observeFields } from '../Phonebook/test-hosts';
import { usersAdminClient as client } from './api';
import { decodeOptions, decodeUser, type UserPage, type UserRecord } from './model';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let actor = { id: 1, role: 'superadmin', effective_permissions: ['users.manage'] };
mockNativeHosts();
mock.module('../../platform/account', () => ({ useAccount: () => ({ ready: true, busy: false, sessionGeneration: api.getSessionGeneration(), user: actor, refresh: async () => {}, clearDeletedSession: async () => {} }) }));
mock.module('../../platform/features', () => ({ useFeatureNavigation: () => ({ open: () => {}, back: () => {} }) }));
mock.module('../../platform/lifecycle', () => ({ useScreenActive: () => true }));
mock.module('../../ui/graphics', () => ({ ProjectIcon: 'icon' }));
const { UsersAdminScreen } = await import('./Index');
const options = decodeOptions({ can_manage_users: true, actor_id: 1, default_role: 'user', roles: [{ value: 'superadmin', label: 'مدير عام', can_be_banned: false }, { value: 'user', label: 'مستخدم', can_be_banned: true }], groups: [], cities: [], limits: { per_page_max: 100, bulk_max: 500 }, sort_columns: ['name'] });
const row = (id: number, name: string): UserRecord => decodeUser({ id, name, email: `${name}@example.test`, role: 'user', is_banned: false, permissions: [], effective_permissions: [], permission_scopes: {}, stored_transit_scope: [], transit_scope: null, created_at: null, deleted_at: null, version: 'a'.repeat(64), is_self: false, actions: { edit: true, delete: true, restore: false, force_delete: false, change_ban: true } });
const oldUser = row(2, 'old-private'), newUser = row(3, 'new-private');
const page = (items: UserRecord[]): UserPage => ({ items, currentPage: 1, lastPage: 1, perPage: 25, total: items.length });
const mounted: ReactTestRenderer[] = [], restore: (() => void)[] = [];
let rendererMessages: unknown[] = [];
function keep(spy: { mockRestore(): void }): void { restore.push(() => spy.mockRestore()); }
beforeEach(() => {
  actor = { id: 1, role: 'superadmin', effective_permissions: ['users.manage'] };
  rendererMessages = [];
  keep(spyOn(console, 'error').mockImplementation(message => { rendererMessages.push(message); }));
  keep(spyOn(client, 'options').mockImplementation(async () => options));
  keep(spyOn(client, 'list').mockImplementation(async filters => page(filters.query === 'new' ? [newUser] : [oldUser])));
  keep(spyOn(client, 'show').mockImplementation(async () => oldUser));
});
afterEach(async () => {
  await act(async () => { for (const view of mounted.splice(0)) view.unmount(); });
  observeFields(() => {});
  for (const undo of restore.splice(0).reverse()) undo();
  expect(rendererMessages.length).toBeGreaterThan(0);
  expect(rendererMessages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
});
async function mount(): Promise<ReactTestRenderer> {
  let view!: ReactTestRenderer;
  await act(async () => { view = create(createElement(UsersAdminScreen, { params: {} })); });
  mounted.push(view); return view;
}
function button(view: ReactTestRenderer, title: string) { return view.root.findAllByType('button').find(item => item.props.title === title)!; }

test('same-session privilege refresh removes the cached list and editor before replacement access resolves', async () => {
  const view = await mount();
  await act(async () => button(view, 'تعديل old-private').props.onPress());
  expect(JSON.stringify(view.toJSON())).toContain('old-private@example.test');
  const observed: string[] = []; observeFields(value => observed.push(value));
  keep(spyOn(client, 'options').mockImplementation(() => new Promise(() => {})));
  actor = { ...actor, role: 'user', effective_permissions: [] };
  await act(async () => view.update(createElement(UsersAdminScreen, { params: {} })));
  expect(observed).toEqual([]);
  expect(JSON.stringify(view.toJSON())).not.toContain('old-private@example.test');
});

test('changing search while select-all is pending never adopts the old filter selection', async () => {
  let finish!: (users: UserRecord[]) => void;
  keep(spyOn(client, 'selectAll').mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  const view = await mount();
  await act(async () => button(view, 'تحديد جميع النتائج (1)').props.onPress());
  await act(async () => view.root.findByType('search').props.onChange('new'));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 330)); });
  expect(JSON.stringify(view.toJSON())).toContain('new-private@example.test');
  await act(async () => finish([oldUser]));
  expect(Boolean(button(view, 'حذف مؤقت المحددين'))).toBe(false);
});

test('cancelling select-all preserves no partial or late selection', async () => {
  let finish!: (users: UserRecord[]) => void;
  keep(spyOn(client, 'selectAll').mockImplementation(() => new Promise(resolve => { finish = resolve; })));
  const view = await mount();
  await act(async () => button(view, 'تحديد جميع النتائج (1)').props.onPress());
  await act(async () => button(view, 'إيقاف التحديد').props.onPress());
  await act(async () => finish([oldUser]));
  expect(Boolean(button(view, 'حذف مؤقت المحددين'))).toBe(false);
});

test('partial bulk completion keeps only the unconfirmed records selected', async () => {
  keep(spyOn(client, 'list').mockImplementation(async () => page([oldUser, newUser])));
  keep(spyOn(client, 'bulkAll').mockImplementation(async () => ({ completed: [oldUser], remaining: [newUser], actorDeleted: false, error: new Error('local connection interrupted') })));
  const view = await mount();
  await act(async () => button(view, 'تحديد هذه الصفحة').props.onPress());
  await act(async () => button(view, 'حذف مؤقت المحددين').props.onPress());
  await act(async () => button(view, 'تأكيد الإجراء').props.onPress());
  expect(view.root.findByProps({ title: 'تحديد old-private' }).props.value).toBe(false);
  expect(view.root.findByProps({ title: 'تحديد new-private' }).props.value).toBe(true);
  expect(JSON.stringify(view.toJSON())).toContain('تم تأكيد حذف مؤقت 1 مستخدماً من 2.');
});
