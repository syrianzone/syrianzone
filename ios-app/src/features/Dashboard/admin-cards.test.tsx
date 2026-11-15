import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType, type ReactNode } from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import catalogue from '../../../../resources/data/site-modules.json';
import capabilities from '../../../../resources/data/capabilities.json';
import * as model from './model';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
function compile(path: string): string {
  const compiled = babel.transformFileSync(fileURLToPath(new URL(path, import.meta.url)), {
  babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
  plugins: ['@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true },
  })?.code;
  if (!compiled) throw new Error('Dashboard production compilation returned no code.');
  return compiled;
}
const code = compile('./Index.tsx');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const destinations: Record<string, string> = {
  transit: 'transit_admin', places: 'places_admin', syofficial: 'syofficial_admin', govapps: 'govapps_admin',
  guesswho: 'guesswho_admin', phonebook: 'phonebook_admin', compass: 'compass', promises: 'promises',
  assets: 'assets_admin', site_popup: 'site_popup_admin', site_navigation: 'navigation_admin', api_tokens: 'api_tokens_admin',
};
type ActionProps = { title: string; disabled?: boolean; onPress(): void };

function renderDashboard(permissions: readonly string[], inspect: (actions: ActionProps[], opened: unknown[][], root: ReactTestInstance) => void): void {
  const opened: unknown[][] = [], module = { exports: {} as { DashboardScreen?: ComponentType<{ params: Record<string, string> }> } };
  const page = { data: { canSubmit: false, canManageUsers: false, banned: false, role: 'superadmin', submissions: [], polls: [] }, reload() {} };
  const account = { user: { effective_permissions: permissions, role: 'superadmin' }, sessionGeneration: 1, busy: false };
  const section = ({ children }: { children: ReactNode }) => createElement(React.Fragment, null, children);
  runInNewContext(code!, { module, exports: module.exports, Symbol, console,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { Alert: { alert() { throw new Error('Unexpected mutation.'); } }, ScrollView: 'scroll', View: 'view' };
      if (name === '../../api') return { api: {} };
      if (name === '../../components') return { AdaptivePanes: ({ primary }: { primary: ReactNode }) => primary, contentStyle: {}, Section: section, Heading: 'heading', Label: 'label', RequestStatus: () => null, FormField: 'field' };
      if (name === '../../platform/account') return { useAccount: () => account };
      if (name === '../../platform/dates') return { formatGregorianSyrianShort: () => '' };
      if (name === '../../platform/features') return { useFeatureNavigation: () => ({ open: (...args: unknown[]) => opened.push(args) }) };
      if (name === '../../resource') return { useResource: () => page };
      if (name === '../../ui/native') return { NativeAction: 'action', NativePicker: 'picker', NativeToggle: 'toggle' };
      if (name === '../../ui/theme') return { useTheme: () => ({ colors: {} }) };
      if (name === './model') return model;
      if (name === './api') return { pollAdminApi() { throw new Error('Unexpected mutation.'); } };
      if (name === './PollEditor') return { PollEditor: () => null, EditorSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? children : null };
      throw new Error('Unexpected Dashboard dependency: ' + name);
    },
  });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReturnType<typeof create> | undefined;
  try {
    act(() => { renderer = create(createElement(module.exports.DashboardScreen!, { params: {} })); });
    const actions = renderer!.root.findAll(node => String(node.type) === 'action').map(node => node.props as ActionProps);
    inspect(actions, opened, renderer!.root);
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  } finally {
    act(() => { renderer?.unmount(); });
    warning.mockRestore();
  }
}


for (const card of catalogue.adminSections) {
  const qualifying = Object.keys(capabilities).filter(permission => 'capability' in card.gate
    ? permission === card.gate.capability : 'module' in card.gate
      ? permission.startsWith(`${card.gate.module}.`) : true);
  test(`${card.id}: each source-effective capability enables the actual native card and correct destination`, () => {
    expect(qualifying.length).toBeGreaterThan(0);
    for (const permission of qualifying) renderDashboard([permission], (actions, opened) => {
      const matching = actions.filter(action => action.title === card.label);
      expect(matching).toHaveLength(1);
      expect(matching[0]!.disabled).not.toBe(true);
      matching[0]!.onPress();
      const params = card.id === 'promises' ? { view: 'admin' } : card.id === 'compass'
        ? { view: permission === 'compass.stats' ? 'admin-stats' : permission === 'compass.figures' ? 'admin-figures' : 'admin-personas' } : undefined;
      expect(opened).toEqual(params ? [[destinations[card.id], params]] : [[destinations[card.id]]]);
    });
  });
}

test('ungranted cards stay absent even for a role named superadmin and sibling modules gain no admin route', () => {
  for (const permissions of [[], ['unknown.future'], ['recipes.manage', 'answers.manage']]) {
    renderDashboard(permissions, (actions, opened) => {
      expect(actions.filter(action => catalogue.adminSections.some(card => card.label === action.title))).toHaveLength(0);
      expect(opened).toEqual([]);
    });
  }
});

test('each known effective permission shows exactly the source-authorized catalogue cards', () => {
  for (const permission of Object.keys(capabilities)) renderDashboard([permission], actions => {
    const expected = catalogue.adminSections.filter(card => 'capability' in card.gate
      ? card.gate.capability === permission : 'module' in card.gate
        ? permission.startsWith(`${card.gate.module}.`) : true).map(card => card.label);
    expect(actions.filter(action => catalogue.adminSections.some(card => card.label === action.title)).map(action => action.title)).toEqual(expected);
  });
});

test('unknown and sibling admin destinations remain unavailable', () => {
  for (const id of ['unknown', 'recipes', 'answers']) expect(model.dashboardAdminDestination(id, Object.keys(capabilities))).toBeNull();
});

test('Compass preserves its source admin destination priority when multiple capabilities are effective', () => {
  for (const [permissions, view] of [
    [['compass.personas', 'compass.figures'], 'admin-figures'],
    [['compass.personas', 'compass.stats', 'compass.figures'], 'admin-stats'],
  ] as const) renderDashboard(permissions, (actions, opened) => {
    actions.find(action => action.title === 'بوصلة سوريا')!.onPress();
    expect(opened).toEqual([['compass', { view }]]);
  });
});

test('the actual new-poll form preserves literal titles and URL slug traits', () => {
  renderDashboard(['polls.create'], (_actions, _opened, root) => {
    act(() => root.findAll(node => String(node.type) === 'picker').find(node => node.props.label === 'قسم لوحة التحكم')!.props.onChange('polls'));
    act(() => root.findAll(node => String(node.type) === 'action').find(node => node.props.title === 'إنشاء استبيان جديد')!.props.onPress());
    const field = (label: string) => root.findAll(node => String(node.type) === 'field').find(node => node.props.label === label)!;
    expect(field('العنوان').props.autoCorrect).toBe(false);
    expect(field('المعرف (Slug)').props.autoCorrect).toBeUndefined();
    expect(field('المعرف (Slug)').props.keyboardType).toBe('url');
    act(() => field('العنوان').props.onChange('استبيان تحقق محلي'));
    expect(field('العنوان').props.value).toBe('استبيان تحقق محلي');
  });
});

test('the actual poll editor keeps only exercised names and short titles literal', () => {
  const editorCode = compile('./PollEditor.tsx');
  const module = { exports: {} as { PollEditor?: ComponentType<{ pollId: string; onChanged(): void; onClose(): void }> } };
  const permissions = ['polls.create', 'polls.edit'];
  const page = { data: { poll: { id: '11111111-1111-4111-8111-111111111111', slug: 'owned-poll', title: 'عنوان حالي', active: true }, groups: [], candidates: [] }, loading: false, reload() {} };
  runInNewContext(editorCode, { module, exports: module.exports, Symbol, console,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { View: 'view', Alert: { alert() { throw new Error('Unexpected mutation.'); } } };
      if (name === 'expo-image') return { Image: 'image' };
      if (name === '../../platform/Sheet') return { EditorSheet: ({ visible, children }: { visible: boolean; children: ReactNode }) => visible ? children : null };
      if (name === '../../api') return { api: { getSessionGeneration: () => 1 } };
      if (name === '../../components') return { FormField: 'field', Heading: 'heading', Label: 'label', RequestStatus: () => null, Section: 'section' };
      if (name === '../../platform/account') return { useAccount: () => ({ user: { effective_permissions: permissions }, sessionGeneration: 1, busy: false }) };
      if (name === '../../platform/features') return { useFeatureNavigation: () => ({ open() { throw new Error('Unexpected navigation.'); } }) };
      if (name === '../../platform/uploads') return { pickImage() { throw new Error('Unexpected photo access.'); } };
      if (name === '../../platform/validation') return { assetUrl() { throw new Error('Unexpected image URL.'); } };
      if (name === '../../resource') return { useResource: () => page };
      if (name === '../../ui/native') return { NativeAction: 'action', NativeDatePicker: 'date', NativePicker: 'picker', NativeSegmented: 'segments', NativeToggle: 'toggle' };
      if (name === '../../ui/theme') return { useTheme: () => ({ colors: {} }) };
      if (name === './api') return { candidateImageBounds: {}, pollAdminApi: () => ({}) };
      if (name === './model') return model;
      throw new Error('Unexpected poll editor dependency: ' + name);
    }
  });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReturnType<typeof create> | undefined;
  try {
    act(() => { renderer = create(createElement(module.exports.PollEditor!, { pollId: page.data.poll.id, onChanged() {}, onClose() {} })); });
    const field = (label: string) => renderer!.root.findAll(node => String(node.type) === 'field').find(node => node.props.label === label)!;
    expect(field('العنوان').props.autoCorrect).toBe(false);
    expect(field('اسم مجموعة جديدة').props.autoCorrect).toBe(false);
    expect(field('المعرف (Slug)').props.autoCorrect).toBeUndefined();
    expect(field('المعرف (Slug)').props.keyboardType).toBe('url');
    act(() => renderer!.root.findAll(node => String(node.type) === 'action').find(node => node.props.title === 'إضافة مرشح')!.props.onPress());
    expect(field('الاسم').props.autoCorrect).toBe(false);
    expect(field('الصفة').props.autoCorrect).toBe(false);
    expect(field('معرف X').props.autoCorrect).toBeUndefined();
    expect(field('رابط صورة مباشر (HTTPS)').props.keyboardType).toBe('url');
    act(() => field('الاسم').props.onChange('مرشح تحقق محلي'));
    expect(field('الاسم').props.value).toBe('مرشح تحقق محلي');
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  } finally {
    act(() => renderer?.unmount()); warning.mockRestore();
  }
});
