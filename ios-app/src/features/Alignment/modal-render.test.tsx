import { expect, spyOn, test } from 'bun:test';
import React, { createElement, Fragment, type ComponentType, type ElementType, type ReactNode } from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import * as model from './model';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const modalHost = 'modal' as ElementType, headingHost = 'heading' as ElementType, actionHost = 'action' as ElementType;
const fieldHost = 'field' as ElementType, drawingHost = 'drawing' as ElementType;
const colors = { text: '#111', secondary: '#666', danger: '#c00', separator: '#ccc', background: '#fff', surface: '#fff' };

function compiledScreen(initial: model.Alignment, mode: 'compact' | 'wide', writes: unknown[], broken = false): ComponentType {
  const code = babel.transformFileSync(fileURLToPath(new URL('./Index.tsx', import.meta.url)), {
    babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
  })?.code;
  if (!code) throw new Error('Alignment production compilation returned no code.');
  const dependencies: Record<string, unknown> = {
    'react-native': {
      View: 'view', ScrollView: 'scroll',
      Modal: (props: { visible: boolean; children: ReactNode; onRequestClose(): void }) => createElement('modal', props, props.visible ? props.children : null),
      FlatList: (props: { data: model.Dot[]; ListHeaderComponent: ReactNode; ListEmptyComponent: ReactNode; renderItem(input: { item: model.Dot }): ReactNode }) =>
        createElement('list', null, props.ListHeaderComponent, props.data.length
          ? props.data.map(item => createElement(Fragment, { key: item.id }, props.renderItem({ item }))) : props.ListEmptyComponent)
    },
    '../../components': {
      AdaptivePanes: (props: { compact?: ReactNode; primary: ReactNode; secondary?: ReactNode }) => mode === 'compact'
        ? props.compact ?? props.primary : createElement('panes', null, props.primary, props.secondary),
      contentStyle: {}, EmptyState: 'empty', FormField: 'field', Heading: 'heading', Label: 'label', Section: 'section'
    },
    '../../platform/links': { openExternal: () => { throw new Error('Confirmation must not open an external link.'); } },
    '../../platform/files': { shareFile: () => { throw new Error('Confirmation must not export.'); }, shareSvgImage: () => { throw new Error('Confirmation must not export.'); } },
    '../../platform/storage': {
      readDocument: async () => { if (broken) throw new Error('Owned unreadable-document fixture.'); return initial; },
      writeDocument: async (key: string, value: unknown) => { if (key !== 'alignment.v1') throw new Error('Unexpected document write.'); writes.push(value); }
    },
    '../../platform/lifecycle': { useScreenActive: () => true },
    '../../ui/native': { NativeAction: 'action', NativeColorPicker: 'color', NativePicker: 'picker' },
    '../../ui/theme': { useTheme: () => ({ colors }) }, './Drawing': { AlignmentDrawing: 'drawing' }, './model': model
  };
  const output = { exports: {} as Record<string, unknown> };
  runInNewContext(code, { module: output, exports: output.exports, console, Symbol, AbortController, Date, setTimeout, clearTimeout,
    require(name: string): unknown {
      if (name === 'react') return React;
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error('Unexpected Alignment confirmation dependency: ' + name);
    }
  });
  return output.exports.AlignmentScreen as ComponentType;
}

function visibleSheets(root: ReactTestInstance): ReactTestInstance[] { return root.findAll(node => node.type === modalHost && node.props.visible === true); }
function sheet(root: ReactTestInstance): ReactTestInstance { const nodes = visibleSheets(root); expect(nodes).toHaveLength(1); return nodes[0]!; }
function hasHeading(root: ReactTestInstance, title: string): boolean { return root.findAll(node => node.type === headingHost && node.props.children === title).length === 1; }
async function press(root: ReactTestInstance, title: string): Promise<void> {
  const matches = root.findAll(node => node.type === actionHost && node.props.title === title);
  expect(matches).toHaveLength(1);
  await act(async () => { matches[0]!.props.onPress(); });
}

// Native116 supplies the runtime RED. This actual compiled render verifies the presentation/state contract, not native sheet geometry.
test('one native sheet hosts point confirmation, Cancel, exact removal and dismissal in both layouts', async () => {
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const mode of ['compact', 'wide'] as const) {
      const initial = model.addDot(model.addDot(model.defaultAlignment(), { x: 0.375, y: 0.625 }, 11), { x: 0.8, y: 0.2 }, 22);
      const writes: unknown[] = [], Screen = compiledScreen(initial, mode, writes);
      let renderer: ReactTestRenderer | undefined;
      try {
        await act(async () => { renderer = create(createElement(Screen)); });
        const root = () => renderer!.root;
        const state = () => root().findByType(drawingHost).props.state as model.Alignment;
        await press(root(), 'تعديل 2 نقطة');
        await press(sheet(root()), 'حذف نقطة 1');
        expect(visibleSheets(root())).toHaveLength(1);
        expect(root().findAllByType(modalHost)).toHaveLength(1);
        expect(hasHeading(sheet(root()), 'حذف هذه النقطة؟')).toBe(true);
        expect(sheet(root()).findAllByType(fieldHost)).toHaveLength(0);
        expect(state()).toEqual(initial);
        await press(sheet(root()), 'إلغاء');
        expect(hasHeading(sheet(root()), 'نقاط البوصلة')).toBe(true);
        expect(state()).toEqual(initial);
        await press(sheet(root()), 'حذف نقطة 1');
        await act(async () => { sheet(root()).props.onRequestClose(); });
        expect(visibleSheets(root())).toHaveLength(0); expect(state()).toEqual(initial);
        await press(root(), 'تعديل 2 نقطة');
        expect(hasHeading(sheet(root()), 'نقاط البوصلة')).toBe(true);
        expect(hasHeading(sheet(root()), 'حذف هذه النقطة؟')).toBe(false);
        await press(sheet(root()), 'حذف نقطة 1');
        await press(sheet(root()), 'تأكيد الحذف');
        expect(visibleSheets(root())).toHaveLength(1);
        expect(hasHeading(sheet(root()), 'نقاط البوصلة')).toBe(true);
        expect(state()).toEqual(model.removeDot(initial, 11));
        expect(state().dots[0]).toEqual(initial.dots[1]);
        expect(sheet(root()).findAll(node => node.type === fieldHost && node.props.label === 'اسم النقطة 11')).toHaveLength(0);
        expect(sheet(root()).findAll(node => node.type === fieldHost && node.props.label === 'اسم النقطة 22')).toHaveLength(1);
        await press(sheet(root()), 'تم');
        expect(visibleSheets(root())).toHaveLength(0);
      } finally { if (renderer) await act(async () => { renderer?.unmount(); }); }
    }
  } finally {
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});

test('the same sheet keeps unreadable-document reset Cancel, dismissal and confirmed recovery intact', async () => {
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  const writes: unknown[] = [], initial = model.defaultAlignment(), Screen = compiledScreen(initial, 'compact', writes, true);
  try {
    await act(async () => { renderer = create(createElement(Screen)); });
    const root = () => renderer!.root;
    const reset = 'حذف الرسم المحفوظ وبدء رسم جديد';
    await press(root(), reset);
    expect(root().findAllByType(modalHost)).toHaveLength(1);
    expect(hasHeading(sheet(root()), 'حذف الرسم المحفوظ؟')).toBe(true);
    await press(sheet(root()), 'إلغاء');
    expect(visibleSheets(root())).toHaveLength(0); expect(root().findAllByType(drawingHost)).toHaveLength(0); expect(writes).toHaveLength(0);
    await press(root(), reset);
    await act(async () => { sheet(root()).props.onRequestClose(); });
    expect(visibleSheets(root())).toHaveLength(0); expect(writes).toHaveLength(0);
    await press(root(), reset);
    expect(hasHeading(sheet(root()), 'حذف الرسم المحفوظ؟')).toBe(true);
    await press(sheet(root()), 'تأكيد الحذف');
    expect(visibleSheets(root())).toHaveLength(0);
    expect(root().findByType(drawingHost).props.state).toEqual(model.defaultAlignment());
    expect(writes).toContainEqual(model.defaultAlignment());
  } finally {
    if (renderer) await act(async () => { renderer?.unmount(); });
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});
