import { expect, spyOn, test } from 'bun:test';
import React, { createElement, useState, type ComponentType } from 'react';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import * as traceModel from './account-input-trace';
import * as traceSession from './account-input-trace-session';
import * as accountModel from './account-fixture-model';
import { createPersistenceScopes } from '../src/platform/persistence-scope-model';

const root = new URL('../', import.meta.url), require = createRequire(new URL('package.json', root));
const nonce = 'cc615efc-18d0-40b9-9837-aec759d62bfa', origin = 'https://127.0.0.1:9443';
const babel = require('@babel/core') as { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null };
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
function compiled(path: URL, dependencies: Record<string, unknown>, globals: Record<string, unknown> = {}): Record<string, unknown> {
  const code = babel.transformFileSync(fileURLToPath(path), {
    babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
    plugins: [() => ({ pre(file: { set(key: string, value: boolean): void }) { file.set('@babel/plugin-proposal-dynamic-import', true); } }), '@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, preserveEnvVars: true }
  })?.code;
  if (!code) throw new Error('Input trace actual entry compilation failed.');
  const module = { exports: {} as Record<string, unknown> };
  runInNewContext(code, { module, exports: module.exports, Symbol, URL, URLSearchParams, Headers, Request, Response, AbortController, setTimeout, clearTimeout, console, ...globals,
    require(name: string): unknown {
      if (name === 'react') return React;
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return require(name);
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error('Unexpected input trace entry import: ' + name);
    }
  });
  return module.exports;
}
function response(value: unknown, url: string): Response { return Object.defineProperty(Response.json(value), 'url', { value: url }); }

async function entry(enabled: boolean, frozen: boolean, inspect: (renderer: ReturnType<typeof create>, events: string[], namespace: Record<string, unknown>) => Promise<void>) {
  const events: string[] = [];
  const Original = (props: Record<string, unknown>) => createElement('input', props);
  Original.displayName = 'TextInput'; Original.State = { currentlyFocusedInput: () => null };
  const native: Record<string, unknown> = { View: 'view', Text: 'text', Pressable: 'button', StyleSheet: { create: (value: unknown) => value } };
  const descriptor = { configurable: true, enumerable: true, get: () => Original };
  Object.defineProperty(native, 'TextInput', descriptor);
  if (frozen) Object.freeze(native);
  const colors = { text: 'black', separator: 'gray' };
  const components = compiled(new URL('src/components.tsx', root), { 'react-native': native, 'expo-image': {}, './ui/native': {}, './ui/theme': { useTheme: () => ({ colors }) }, './layout': {}, './NativeLayout': {} });
  const FormField = components.FormField as ComponentType<Record<string, unknown>>;
  function App() { const [value, setValue] = useState(''); return createElement(FormField, { label: 'اسم مجموعة جديدة', value, onChange: setValue, autoCorrect: false }); }
  const dependencies: Record<string, unknown> = {
    'react-native': native, 'expo': { registerRootComponent(value: ComponentType) { Entry = value; } },
    'expo-linking': { addEventListener: () => ({ remove() {} }), getInitialURL: async () => 'syrianzone://fixture/session?user=admin#synthetic_input_trace_gate_only', openURL() { throw new Error('Trace commands must not invoke Linking.'); } },
    'expo-secure-store': { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'private', setItemAsync: async () => { events.push('token'); } },
    'expo-sqlite': {}, 'expo-crypto': {},
    '../src/platform/persistence': { getPersistenceScope: () => createPersistenceScopes(async value => createHash('sha256').update(value).digest('hex'))(origin) },
    '../src/platform/site-origin': { configuredSiteOrigin: origin }, './account-fixture-model': accountModel,
    './account-input-trace': traceModel, './account-input-trace-session': traceSession,
    './prayer-sync/prayer-local-store': {}, './prayer-sync/prayer-launch-model': { parsePrayerFixtureLaunch: () => null },
    './prayer-sync/prayer-local-journal': {}, './prayer-sync/prayer-session-fixture': {}, './prayer-sync/prayer-restore-fixture': {}, './prayer-sync/prayer-times-fixture': {},
    './alignment/alignment-launch-model': { parseAlignmentFixtureLaunch: () => null },
    './alignment/alignment-fixture-model': {}, './alignment/alignment-local-store': {}, './alignment/alignment-session-fixture': {},
    './studio-cleanup': {}, './studio-fixture-model': {}, './quran-audio-observer': {},
  };
  let Entry: ComponentType | undefined;
  const transport = Object.assign(async (input: RequestInfo | URL): Promise<Response> => {
    const url = String(input);
    if (url.endsWith('/__native_fixture/session?user=admin')) return response({ origin, token: '71|synthetic_fresh_trace_session_only' }, url);
    if (url.endsWith('/api/v1/user')) { events.push('verified'); return response({ id: 103 }, url); }
    if (url.endsWith('/api/v1/auth/logout')) { events.push('revoke'); return response({ ok: true }, url); }
    throw new Error('Unexpected trace entry transport.');
  }, { preconnect: fetch.preconnect });
  Object.defineProperty(dependencies, '../src/App', { get() {
    events.push('App import'); expect(native.TextInput === Original).toBe(!enabled); return { __esModule: true, default: App };
  } });
  compiled(new URL('./account-fixture.tsx', import.meta.url), dependencies, { fetch: transport, process: { env: enabled ? { EXPO_PUBLIC_NATIVE_INPUT_TRACE: '1' } : {} } });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReturnType<typeof create> | undefined;
  try {
    expect(Entry).toBeDefined();
    await act(async () => { renderer = create(createElement(Entry!)); });
    await inspect(renderer!, events, native);
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  } finally { await act(async () => renderer?.unmount()); warning.mockRestore(); }
  expect(Object.getOwnPropertyDescriptor(native, 'TextInput')).toEqual(frozen ? { ...descriptor, configurable: false } : descriptor);
}

test('actual entry installs after verification/before App, reads only on request and preserves actual FormField callback order', async () => {
  await entry(true, false, async (renderer, events) => {
    expect(events).toEqual(['verified', 'token', 'App import']);
    const header = () => renderer.root.findAllByType('input').find(node => node.props.testID === 'account.fixture.destination')!;
    const status = () => renderer.root.findAllByType('text').find(node => node.props.testID === 'account.fixture.status')!;
    const read = () => renderer.root.findAllByType('button').find(node => node.props.testID === 'account.fixture.input-trace.read')!;
    expect(read().props.disabled).toBe(true);
    expect(read().props.style).toMatchObject({ width: 44, height: 44 });
    expect(read().props.accessibilityRole).toBe('button');
    expect(read().parent!.props.style).toMatchObject({ flexDirection: 'row' });
    expect(read().parent!.findAllByType('input')).toHaveLength(1);
    await act(async () => header().props.onSubmitEditing({ nativeEvent: { text: `inputtrace.arm.poll-group.${nonce}` } }));
    const armed = status().props.accessibilityValue.text;
    expect(read().props.disabled).toBe(false);
    expect(JSON.parse(armed).inputTrace).toMatchObject({ phase: 'armed', nonce, requestSequence: 1 });
    const field = () => renderer.root.findAllByType('input').find(node => node.props.accessibilityLabel === 'اسم مجموعة جديدة')!;
    await act(async () => {
      field().props.onFocus({ nativeEvent: {} });
      field().props.onChange({ nativeEvent: { text: 'مو', eventCount: 3 } });
      field().props.onChangeText('مو');
    });
    expect(field().props.value).toBe('مو'); expect(status().props.accessibilityValue.text).toBe(armed);
    await act(async () => read().props.onPress());
    const captured = JSON.parse(status().props.accessibilityValue.text).inputTrace;
    expect(captured.requestSequence).toBe(2);
    expect(captured.events.map((event: { kind: string }) => event.kind)).toEqual(['focus', 'native-change', 'change-text', 'value-commit']);
    expect(captured.events[1]).toMatchObject({ text: 'مو', eventCount: 3 });
    await act(async () => read().props.onPress());
    expect(JSON.parse(status().props.accessibilityValue.text).inputTrace.requestSequence).toBe(3);
    expect(header().props.value).toBe('');
    await act(async () => header().props.onSubmitEditing({ nativeEvent: { text: `inputtrace.read.${nonce}` } }));
    expect(JSON.parse(status().props.accessibilityValue.text).inputTrace.requestSequence).toBe(3);
  });
});

test('ordinary entry is unchanged and a frozen namespace refuses before token/App while revoking only its fresh session', async () => {
  await entry(false, false, async (renderer, events) => {
    expect(events).toEqual(['verified', 'token', 'App import']);
    expect(renderer.root.findAllByType('button')).toHaveLength(0);
  });
  await entry(true, true, async (renderer, events) => {
    expect(events).toEqual(['verified', 'revoke']);
    expect(renderer.root.findAllByType('text').find(node => node.props.testID === 'account.fixture.status')!.props.children).toBe('LOCAL FIXTURE SETUP FAILED');
  });
});
