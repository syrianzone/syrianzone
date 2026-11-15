import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType, type ElementType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import type { GestureResponderEvent, PanResponderCallbacks, PanResponderGestureState } from 'react-native';
import * as model from './model';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
function compiled(url: URL, dependencies: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const code = babel.transformFileSync(fileURLToPath(url), {
    babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
  })?.code;
  if (!code) throw new Error('Alignment production compilation returned no code.');
  const output = { exports: {} as Record<string, unknown> };
  runInNewContext(code, { module: output, exports: output.exports, console, Symbol, AbortController, Date, setTimeout, clearTimeout,
    require(name: string): unknown {
      if (name === 'react') return React;
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error('Unexpected Alignment render dependency: ' + name);
    }
  });
  return output.exports;
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const scrollHost = 'scroll' as ElementType;
const colors = { text: '#111', secondary: '#666', danger: '#c00', separator: '#ccc', background: '#fff', surface: '#fff' };
const theme = { useTheme: () => ({ colors }) };
const event = (x: number, y: number) => ({ nativeEvent: { locationX: x, locationY: y } }) as GestureResponderEvent;
const gesture = {} as PanResponderGestureState;

test('the real canvas locks only an existing point drag and releases on up, cancellation and unmount', async () => {
  let pan: PanResponderCallbacks = {};
  const native = { View: 'view', PanResponder: { create: (callbacks: PanResponderCallbacks) => { pan = callbacks; return { panHandlers: {} }; } } };
  const Drawing = compiled(new URL('./Drawing.tsx', import.meta.url), {
    'react-native': native, 'react-native-svg': { __esModule: true, default: 'svg', Circle: 'circle', G: 'group', Line: 'line', Rect: 'rect', Text: 'svg-text' },
    '../../ui/theme': theme, './model': model
  }).AlignmentDrawing as ComponentType<React.ComponentProps<typeof import('./Drawing').AlignmentDrawing>>;
  const locks: boolean[] = [], selections: number[] = [];
  let state = model.addDot(model.defaultAlignment(), { x: 0.25, y: 0.30 }, 123), renderer: ReactTestRenderer | undefined;
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  const render = async (disabled = false) => {
    const element = createElement(Drawing, { state, disabled, svgRef: { current: null }, onChange: update => { state = update(state); },
      onSelect: id => { selections.push(id); }, onDraggingChange: value => { locks.push(value); } } as React.ComponentProps<typeof Drawing>);
    await act(async () => { if (renderer) renderer.update(element); else renderer = create(element); });
  };
  const fire = async (callback: (() => void) | undefined) => { await act(async () => { callback?.(); }); };
  try {
    await render();
    await act(async () => { renderer!.root.findByProps({ accessibilityRole: 'image' }).props.onLayout({ nativeEvent: { layout: { width: 358 } } }); });
    await fire(() => pan.onPanResponderGrant?.(event(358 * 0.25 + 2, 358 * 0.30 + 3), gesture));
    expect(locks).toEqual([true]); expect(selections).toEqual([123]);
    expect(pan.onPanResponderTerminationRequest?.(event(0, 0), gesture)).toBe(false);
    await fire(() => pan.onPanResponderMove?.(event(358 * 0.65 + 2, 358 * 0.55 + 3), gesture));
    expect(state.dots).toHaveLength(1); expect(state.dots[0]?.x).toBeCloseTo(0.65, 10); expect(state.dots[0]?.y).toBeCloseTo(0.55, 10);
    await fire(() => pan.onPanResponderRelease?.(event(0, 0), gesture));
    expect(locks).toEqual([true, false]);
    await render();
    await fire(() => pan.onPanResponderGrant?.(event(358 * 0.65, 358 * 0.55), gesture));
    await fire(() => pan.onPanResponderTerminate?.(event(0, 0), gesture));
    expect(locks).toEqual([true, false, true, false]);
    await fire(() => pan.onPanResponderGrant?.(event(10, 10), gesture));
    expect(state.dots).toHaveLength(2); expect(locks).toEqual([true, false, true, false]);
    await render(true);
    expect(pan.onStartShouldSetPanResponder?.(event(0, 0), gesture)).toBe(false);
    await fire(() => pan.onPanResponderGrant?.(event(358 * 0.65, 358 * 0.55), gesture));
    expect(locks).toEqual([true, false, true, false]);
    await render();
    await fire(() => pan.onPanResponderGrant?.(event(358 * 0.65, 358 * 0.55), gesture));
    await act(async () => { renderer!.unmount(); }); renderer = undefined;
    expect(locks).toEqual([true, false, true, false, true, false]);
  } finally {
    if (renderer) await act(async () => { renderer?.unmount(); });
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});

test('compact and wide screens pause only the drawing owner while its real point responder is active', async () => {
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  try {
    for (const mode of ['compact', 'wide'] as const) {
      let pan: PanResponderCallbacks = {};
      const native = { View: 'view', ScrollView: 'scroll', Modal: 'modal', FlatList: 'list',
        PanResponder: { create: (callbacks: PanResponderCallbacks) => { pan = callbacks; return { panHandlers: {} }; } } };
      const Drawing = compiled(new URL('./Drawing.tsx', import.meta.url), { 'react-native': native,
        'react-native-svg': { __esModule: true, default: 'svg', Circle: 'circle', G: 'group', Line: 'line', Rect: 'rect', Text: 'svg-text' }, '../../ui/theme': theme, './model': model });
      const initial = model.addDot(model.defaultAlignment(), { x: 0.25, y: 0.30 }, 123);
      const writes: unknown[] = [];
      const Screen = compiled(new URL('./Index.tsx', import.meta.url), {
        'react-native': native, '../../components': { AdaptivePanes: (props: { compact: ReactNode; primary: ReactNode; secondary: ReactNode }) => mode === 'compact' ? props.compact : createElement('panes', null, props.primary, props.secondary),
          contentStyle: {}, EmptyState: 'empty', FormField: 'field', Heading: 'heading', Label: 'label', Section: 'section' },
        '../../platform/links': { openExternal: () => { throw new Error('Drag must not open a link.'); } },
        '../../platform/files': { shareFile: () => { throw new Error('Drag must not export.'); }, shareSvgImage: () => { throw new Error('Drag must not export.'); } },
        '../../platform/storage': { readDocument: async () => initial, writeDocument: async (...args: unknown[]) => { writes.push(args); } },
        '../../platform/lifecycle': { useScreenActive: () => true }, '../../ui/native': { NativeAction: 'action', NativeColorPicker: 'color', NativePicker: 'picker' },
        '../../ui/theme': theme, './Drawing': Drawing, './model': model
      }).AlignmentScreen as ComponentType;
      let renderer: ReactTestRenderer | undefined;
      try {
        await act(async () => { renderer = create(createElement(Screen)); });
        const canvas = () => renderer!.root.findByProps({ accessibilityRole: 'image' });
        const owner = () => { let node = canvas().parent; while (node && node.type !== scrollHost) node = node.parent; if (!node) throw new Error('Canvas scroll owner missing.'); return node; };
        const others = () => renderer!.root.findAll(node => node.type === scrollHost && node !== owner());
        expect(owner().props.scrollEnabled).not.toBe(false);
        await act(async () => { canvas().props.onLayout({ nativeEvent: { layout: { width: 358 } } }); });
        await act(async () => { pan.onPanResponderGrant?.(event(89.5, 107.4), gesture); });
        expect(owner().props.scrollEnabled).toBe(false);
        expect(others().every(node => node.props.scrollEnabled !== false)).toBe(true);
        await act(async () => { pan.onPanResponderMove?.(event(232.7, 196.9), gesture); });
        const dot = renderer!.root.findByType('circle');
        expect(dot.props.cx).toBeCloseTo(232.7, 10); expect(dot.props.cy).toBeCloseTo(196.9, 10);
        await act(async () => { pan.onPanResponderRelease?.(event(232.7, 196.9), gesture); });
        expect(owner().props.scrollEnabled).toBe(true);
        await act(async () => { pan.onPanResponderGrant?.(event(232.7, 196.9), gesture); pan.onPanResponderTerminate?.(event(232.7, 196.9), gesture); });
        expect(owner().props.scrollEnabled).toBe(true);
      } finally {
        if (renderer) await act(async () => { renderer?.unmount(); });
      }
      expect(writes.every(row => Array.isArray(row) && row[0] === 'alignment.v1')).toBe(true);
    }
  } finally {
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});
