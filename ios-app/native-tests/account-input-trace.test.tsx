import { expect, spyOn, test } from 'bun:test';
import { createElement, type ComponentType, type ReactElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { inputTraceCommand, installInputTrace } from './account-input-trace';

const root = new URL('../', import.meta.url), require = createRequire(new URL('package.json', root));
const nonce = 'cc615efc-18d0-40b9-9837-aec759d62bfa';
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function namespace(component: unknown): Record<string, unknown> {
  const babel = require('@babel/core') as { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null };
  const code = babel.transformFileSync(fileURLToPath(new URL('node_modules/react-native/index.js', root)), {
    babelrc: false, configFile: false, presets: ['babel-preset-expo'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: true, supportsStaticESM: true }
  })?.code;
  if (!code) throw new Error('Installed RN entry compilation failed.');
  const module = { exports: {} };
  runInNewContext(code, { module, exports: module.exports, __DEV__: false, Object,
    require(name: string): unknown {
      if (name === './Libraries/Utilities/warnOnce') return { default() {} };
      if (name === 'invariant') return () => {};
      if (name === './Libraries/Components/TextInput/TextInput') return { default: component };
      throw new Error('Unexpected RN entry load: ' + name);
    }
  });
  return module.exports;
}

function original() {
  const Component = (props: Record<string, unknown>) => createElement('input', props);
  Component.displayName = 'TextInput';
  Component.State = { currentlyFocusedInput: () => null };
  return Component;
}

function installedTextInput(): (props: Record<string, unknown>) => ReactElement<Record<string, unknown>> {
  const babel = require('@babel/core') as { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null };
  const code = babel.transformFileSync(fileURLToPath(new URL('node_modules/react-native/Libraries/Components/TextInput/TextInput.js', root)), {
    babelrc: false, configFile: false, presets: ['babel-preset-expo'], plugins: ['@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: true, supportsStaticESM: true }
  })?.code;
  if (!code) throw new Error('Installed TextInput compilation failed.');
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(code, { module, exports: module.exports, __DEV__: false, Object,
    require(name: string): unknown {
      if (name === 'react' || name.startsWith('@babel/runtime/') || name === 'react/jsx-runtime') return require(name);
      if (name === '../../Utilities/Platform') return { __esModule: true, default: { OS: 'ios' } };
      if (name === '../../StyleSheet/StyleSheet') return { __esModule: true, default: { create: (value: unknown) => value } };
      if (name === './TextInputState') return { __esModule: true, default: { currentlyFocusedInput: () => null } };
      if (name === './RCTSingelineTextInputNativeComponent' || name === './RCTMultilineTextInputNativeComponent') return { __esModule: true, default: 'input', Commands: {} };
      if (['../../Pressability/usePressability', '../../StyleSheet/flattenStyle', '../../Text/Text', '../../Text/TextAncestorContext', '../../Utilities/useMergeRefs', 'invariant', 'nullthrows'].includes(name)) return { __esModule: true, default: null };
      throw new Error('Unexpected installed TextInput import: ' + name);
    }
  });
  return module.exports.default as ReturnType<typeof installedTextInput>;
}

test('the installed RN entry has a replaceable getter and its actual TextInput source uses a plain React19 function', () => {
  const component = installedTextInput(), rn = namespace(component), descriptor = Object.getOwnPropertyDescriptor(rn, 'TextInput');
  expect(descriptor?.configurable).toBe(true); expect(typeof descriptor?.get).toBe('function');
  expect(typeof component).toBe('function'); expect(Reflect.get(component, 'render')).toBeUndefined();
  const ref = { current: null }, onChange = () => {}, style = { minHeight: 48 };
  const output = component({ ref, onChange, style });
  expect(output.props.forwardedRef).toBe(ref); expect(output.props.onChange).toBe(onChange); expect(output.props.style).toBe(style);
  const trace = installInputTrace(rn, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 });
  trace.dispose(); expect(rn.TextInput).toBe(component);
});

test('the armed observer preserves original component, props, ref, callbacks and return values while recording real event order', async () => {
  const Original = original(), rn = namespace(Original), before = Object.getOwnPropertyDescriptor(rn, 'TextInput');
  const trace = installInputTrace(rn, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 }, () => 12);
  expect((rn.TextInput as typeof Original).State).toBe(Original.State);
  trace.arm(`inputtrace.arm.poll-group.${nonce}`);
  const ref = { current: null }, style = { minHeight: 48 }, calls: unknown[] = [];
  const handlers = {
    onChange(event: unknown) { calls.push(['native', this, event]); return 41; },
    onChangeText(text: string) { calls.push(['text', this, text]); return 42; },
    onFocus(event: unknown) { calls.push(['focus', this, event]); return 43; },
    onBlur(event: unknown) { calls.push(['blur', this, event]); return 44; }
  };
  const props = { accessibilityLabel: 'اسم مجموعة جديدة', value: '', ref, style, autoCorrect: false, ...handlers };
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(createElement(rn.TextInput as ComponentType<typeof props>, props)); });
    expect(renderer!.root.findByType(Original).props.ref).toBe(ref);
    const input = renderer!.root.findByType('input');
    expect(input.props.style).toBe(style); expect(input.props.autoCorrect).toBe(false);
    const nativeEvent = { nativeEvent: { text: 'مو', eventCount: 3 } }, self = { tag: 'same receiver' };
    expect(input.props.onChange.call(self, nativeEvent)).toBe(41);
    expect(input.props.onChangeText.call(self, 'مو')).toBe(42);
    expect(input.props.onFocus.call(self, nativeEvent)).toBe(43);
    expect(input.props.onBlur.call(self, nativeEvent)).toBe(44);
    expect(calls).toEqual([['native', self, nativeEvent], ['text', self, 'مو'], ['focus', self, nativeEvent], ['blur', self, nativeEvent]]);
    await act(async () => renderer!.update(createElement(rn.TextInput as ComponentType<typeof props>, { ...props, value: 'مو' })));
    const result = trace.read(`inputtrace.read.${nonce}`);
    expect(result.events.filter(event => ['native-change', 'change-text', 'focus', 'blur'].includes(event.kind)).map(event => event.kind))
      .toEqual(['native-change', 'change-text', 'focus', 'blur']);
    expect(result.events.find(event => event.kind === 'native-change')).toMatchObject({ text: 'مو', eventCount: 3 });
    expect(result.events.filter(event => event.kind === 'value-commit').map(event => event.text)).toEqual(['', 'مو']);
    await act(async () => renderer!.unmount());
    expect(trace.read(`inputtrace.read.${nonce}`).events.some(event => event.kind === 'observer-detached')).toBe(true);
  } finally { warning.mockRestore(); trace.dispose(); }
  expect(Object.getOwnPropertyDescriptor(rn, 'TextInput')).toEqual(before);
});

test('scope, protocol, ownership and unknown shapes refuse; other inputs and unknown text are never recorded', async () => {
  const make = () => namespace(original());
  expect(() => installInputTrace(make(), { origin: 'https://syrian.zone', user: 'admin', id: 103 })).toThrow();
  expect(() => installInputTrace(make(), { origin: 'https://127.0.0.1:9443', user: 'member', id: 103 })).toThrow();
  expect(() => installInputTrace(Object.freeze(make()), { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 })).toThrow();
  expect(() => installInputTrace({ TextInput: original() }, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 })).toThrow();
  const rn = make(), trace = installInputTrace(rn, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 });
  expect(() => installInputTrace(rn, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 })).toThrow();
  expect(() => installInputTrace(namespace(rn.TextInput), { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 })).toThrow();
  expect(() => trace.arm(`inputtrace.arm.studio-stop.${nonce}`)).toThrow();
  trace.arm(`inputtrace.arm.poll-group.${nonce}`);
  expect(() => trace.arm(`inputtrace.arm.poll-group.${nonce}`)).toThrow();
  expect(() => trace.read('inputtrace.read.00000000-0000-4000-8000-000000000000')).toThrow();
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  try {
    const callback = () => 9;
    await act(async () => { renderer = create(createElement(rn.TextInput as ComponentType<Record<string, unknown>>, { accessibilityLabel: 'البريد الإلكتروني', value: 'private', onChange: callback })); });
    expect(renderer!.root.findByType('input').props.onChange).toBe(callback);
    expect(trace.read(`inputtrace.read.${nonce}`).events).toEqual([]);
    await act(async () => renderer!.update(createElement(rn.TextInput as ComponentType<Record<string, unknown>>, { accessibilityLabel: 'اسم مجموعة جديدة', value: '', secureTextEntry: true, onChange: callback })));
    expect(renderer!.root.findByType('input').props.onChange).toBe(callback);
    expect(trace.read(`inputtrace.read.${nonce}`).events).toEqual([]);
    await act(async () => renderer!.update(createElement(rn.TextInput as ComponentType<Record<string, unknown>>, { accessibilityLabel: 'اسم مجموعة جديدة', value: '' })));
    renderer!.root.findByType('input').props.onChange({ nativeEvent: { text: 'unrelated-private-text', eventCount: 1 } });
    const result = trace.read(`inputtrace.read.${nonce}`);
    expect(result.events.find(event => event.kind === 'native-change')).toMatchObject({ redacted: true, length: 22 });
    expect(JSON.stringify(result)).not.toContain('unrelated-private-text');
    for (let index = 0; index < 240; index++) renderer!.root.findByType('input').props.onChangeText('م');
    expect(trace.read(`inputtrace.read.${nonce}`).events.length).toBeLessThanOrEqual(192);
    expect(trace.read(`inputtrace.read.${nonce}`).capped).toBe(true);
    expect(new TextEncoder().encode(JSON.stringify(trace.read(`inputtrace.read.${nonce}`))).byteLength).toBeLessThan(65_536);
    await act(async () => renderer!.unmount());
  } finally { warning.mockRestore(); trace.dispose(); }
});

test('the existing header accepts only exact own arm/read commands and metadata acknowledgements', () => {
  const rn = namespace(original()), trace = installInputTrace(rn, { origin: 'https://127.0.0.1:9443', user: 'member', id: 101 });
  try {
    for (const invalid of [`inputtrace.arm.studio-stop.${nonce}?payload=1`, `inputtrace.arm.studio-stop.${nonce.toUpperCase()}`, `inputtrace.arm.poll-group.${nonce}`, 'inputtrace.read', 'home'])
      expect(() => inputTraceCommand(trace, invalid)).toThrow();
    expect(inputTraceCommand(trace, `inputtrace.arm.studio-stop.${nonce}`)).toEqual({ phase: 'armed', version: 1, nonce, slot: 'studio-stop' });
    expect(inputTraceCommand(trace, `inputtrace.read.${nonce}`)).toEqual({ phase: 'captured', version: 1, nonce, slot: 'studio-stop', capped: false, events: [] });
  } finally { trace.dispose(); }
});

test('arming after the real target mounted captures its first subsequent focus and native change without a rerender', async () => {
  const rn = namespace(original()), trace = installInputTrace(rn, { origin: 'https://127.0.0.1:9443', user: 'admin', id: 103 });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(createElement(rn.TextInput as ComponentType<Record<string, unknown>>, { accessibilityLabel: 'اسم مجموعة جديدة', value: '' })); });
    const input = renderer!.root.findByType('input');
    input.props.onChange({ nativeEvent: { text: 'unarmed-private-text', eventCount: 10 } });
    trace.arm(`inputtrace.arm.poll-group.${nonce}`);
    expect(trace.read(`inputtrace.read.${nonce}`).events).toEqual([]);
    input.props.onFocus({ nativeEvent: {} });
    input.props.onChange({ nativeEvent: { text: 'م', eventCount: 11 } });
    input.props.onChangeText('م');
    expect(trace.read(`inputtrace.read.${nonce}`).events.map(event => event.kind)).toEqual(['focus', 'native-change', 'change-text']);
    expect(trace.read(`inputtrace.read.${nonce}`).events[1]).toMatchObject({ text: 'م', eventCount: 11 });
    expect(JSON.stringify(trace.read(`inputtrace.read.${nonce}`))).not.toContain('unarmed-private-text');
    await act(async () => renderer!.unmount());
  } finally { warning.mockRestore(); trace.dispose(); }
});
