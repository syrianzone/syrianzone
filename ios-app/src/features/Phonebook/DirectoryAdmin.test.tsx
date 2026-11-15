import { afterEach, beforeEach, expect, mock, spyOn, test, type Mock } from 'bun:test';
import { createElement, type ReactNode } from 'react';
import { mockNativeHosts } from './test-hosts';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { api, type ApiClient } from '../../api';
import { phonebookAdmin } from './admin-model';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let permissions = ['phonebook.create', 'phonebook.edit', 'phonebook.delete'];
let acknowledged = true;
const fixture = { categories: [{ id: 'emergency', label_ar: 'طوارئ', label_en: 'Emergency', is_active: true, order_column: 0 }], entries: [{ id: 'private', category_id: 'emergency', name_ar: 'سجل خاص', name_en: null, number: '110', is_whatsapp: true, source_url: null, is_active: false, order_column: 0 }] };
mock.module('../../platform/account', () => ({ useAccount: () => ({ ready: true, busy: false, sessionGeneration: api.getSessionGeneration(), user: { effective_permissions: permissions } }) }));
mock.module('../../platform/Sheet', () => ({ EditorSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? createElement('dialog', null, children) : null }));
mock.module('../../platform/uploads', () => ({ pickImage: async () => null, imageFormData: () => new FormData() }));
mock.module('../../platform/lifecycle', () => ({ useScreenActive: () => true }));
mockNativeHosts();
const { DirectoryAdminScreen } = await import('./DirectoryAdmin');
const mounted: ReactTestRenderer[] = [], bodies: unknown[] = [];
let page: Mock<ApiClient['page']>, request: Mock<ApiClient['request']>, warning: Mock<typeof console.error>;
beforeEach(() => {
  permissions = ['phonebook.create', 'phonebook.edit', 'phonebook.delete']; bodies.length = 0; acknowledged = true;
  const read: ApiClient['page'] = async (_path, _component, decode) => decode(fixture);
  const write: ApiClient['request'] = async (_path, decode, options) => { bodies.push(options?.body); return decode({ success: acknowledged }); };
  page = spyOn(api, 'page').mockImplementation(read); request = spyOn(api, 'request').mockImplementation(write);
  warning = spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  await act(async () => { for (const renderer of mounted.splice(0)) renderer.unmount(); });
  page.mockRestore(); request.mockRestore(); const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
  expect(messages.length).toBeGreaterThan(0);
  expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
});
const screen = () => createElement(DirectoryAdminScreen, { definition: phonebookAdmin, params: {} });
async function mount(): Promise<ReactTestRenderer> { let renderer!: ReactTestRenderer; await act(async () => { renderer = create(screen()); }); mounted.push(renderer); return renderer; }
function button(renderer: ReactTestRenderer, title: string) { return renderer.root.findAllByType('button').find(item => item.props.title === title)!; }

test('native directory form validates input and waits for explicit acknowledgement before closing', async () => {
  const renderer = await mount();
  await act(async () => button(renderer, 'إضافة سجل').props.onPress());
  await act(async () => button(renderer, 'حفظ').props.onPress());
  expect(bodies).toHaveLength(0); expect(renderer.root.findAllByType('dialog')).toHaveLength(1);
  await act(async () => {
    renderer.root.findAllByType('input').find(input => input.props.label === 'الاسم بالعربية')!.props.onChange('اسم موثّق');
    renderer.root.findAllByType('input').find(input => input.props.label === 'رقم الهاتف')!.props.onChange('111');
  });
  await act(async () => button(renderer, 'حفظ').props.onPress());
  expect(bodies).toHaveLength(1); expect(bodies[0]).toMatchObject({ name_ar: 'اسم موثّق', number: '111', category_id: 'emergency', is_active: true, is_whatsapp: false });
  expect(renderer.root.findAllByType('dialog')).toHaveLength(0);
});
test('revoking directory permissions removes cached private rows and the open editor synchronously', async () => {
  const renderer = await mount();
  await act(async () => button(renderer, 'تعديل').props.onPress());
  expect(renderer.root.findAllByType('dialog')).toHaveLength(1);
  permissions = [];
  await act(async () => renderer.update(screen()));
  expect(renderer.root.findAllByType('dialog')).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('سجل خاص');
});
test('an unacknowledged write keeps the editor and entered values available for retry', async () => {
  const renderer = await mount(); acknowledged = false;
  await act(async () => button(renderer, 'تعديل').props.onPress());
  await act(async () => renderer.root.findAllByType('input').find(input => input.props.label === 'الاسم بالعربية')!.props.onChange('تعديل محفوظ في النموذج'));
  await act(async () => button(renderer, 'حفظ').props.onPress());
  expect(bodies).toHaveLength(1); expect(renderer.root.findAllByType('dialog')).toHaveLength(1);
  expect(renderer.root.findAllByType('input').find(input => input.props.label === 'الاسم بالعربية')?.props.value).toBe('تعديل محفوظ في النموذج');
});
test('a toggle-only staff member gets the toggle control without create, edit or delete actions', async () => {
  permissions = ['phonebook.toggle'];
  const renderer = await mount();
  expect(renderer.root.findAll(node => node.props.title === 'ظاهر في الدليل')).toHaveLength(1);
  expect(renderer.root.findAllByType('button')).toHaveLength(0);
});
