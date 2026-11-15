import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import facts from '../../../../resources/data/transit.json';
import * as model from './model';
import { canRestorePending, decodePending, pendingKey } from './pending';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
function compiled(url: URL, dependencies: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const code = babel.transformFileSync(fileURLToPath(url), {
    babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
  })?.code;
  if (!code) throw new Error('Studio production compilation returned no code.');
  const output = { exports: {} as Record<string, unknown> };
  runInNewContext(code, { module: output, exports: output.exports, console, Symbol, AbortController,
    require(name: string): unknown {
      if (name === 'react') return React;
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error('Unexpected Studio render dependency: ' + name);
    }
  });
  return output.exports;
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

test('Studio keeps the full Arabic route name through real FormField changes, camera updates and same-process reopening', async () => {
  const colors = { text: '#111', secondary: '#666', danger: '#c00', separator: '#ccc', background: '#fff', surface: '#fff' };
  const native = { View: 'view', Text: 'text', TextInput: 'input', ScrollView: 'scroll', Modal: 'modal', FlatList: 'list', StyleSheet: { create: (value: unknown) => value } };
  const ui = { NativeAction: 'action', NativeIconAction: 'icon-action', NativePicker: 'picker', NativeToggle: 'toggle', NativeSymbol: 'symbol' };
  const components = compiled(new URL('../../components.tsx', import.meta.url), {
    'react-native': native, 'expo-image': { Image: 'image' }, './ui/native': ui, './ui/theme': { useTheme: () => ({ colors }) }, './layout': {}, './NativeLayout': {}
  });
  const memoryDrafts = new Map<string, model.StudioDraft>();
  const account = { ready: true, busy: false, sessionGeneration: 7, user: { id: 101, effective_permissions: [], transit_scope: null } };
  const cities = { data: [{ id: 'damascus', nameAr: 'دمشق', status: 'active', coordinates: { latitude: 33.5, longitude: 36.3 }, zoom: 12 }], loading: false, error: null };
  const reference = { data: null, loading: false, error: null };
  const reads: string[] = [], writes: unknown[] = [], requests: unknown[] = [];
  const forbiddenRequest = (...args: unknown[]): never => { requests.push(args); throw new Error('Route name editing must not send a request.'); };
  const screen = compiled(new URL('./Index.tsx', import.meta.url), {
    'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'safe-area' }, 'expo-crypto': { randomUUID: () => 'synthetic-stop-id' },
    '../../../../resources/data/transit.json': facts,
    '../../api': { api: { getSessionGeneration: () => 7 }, ApiError: class extends Error {} },
    '../../components': { ...components, AdaptivePanes: ({ compact }: { compact: ReactNode }) => compact },
    '../../domain': { routeColor: () => '#111' }, '../../MapView': { MapView: 'map' }, '../../map-data': { cameraForCoordinates: () => null },
    '../../resource': { useResource: (_load: unknown, options?: unknown) => options ? reference : cities },
    '../../platform/account': { useAccount: () => account }, '../../platform/features': { useFeatureNavigation: () => ({ open: forbiddenRequest }) },
    '../../platform/lifecycle': { useScreenActive: () => true },
    '../../platform/storage': { readDocument: async (key: string) => { reads.push(key); return null; }, writeDocument: async (...args: unknown[]) => { writes.push(args); throw new Error('Route name editing must not write a personal document.'); } },
    '../../ui/native': ui, '../../ui/theme': { useTheme: () => ({ colors }) }, '../../ui/graphics': { ProjectIcon: 'project-icon' },
    '../../platform/transit-client': { transitClient: { cities: forbiddenRequest, network: forbiddenRequest } },
    '../../platform/transit-model': {}, '../../platform/geo': {}, './api': { studioClient: { load: forbiddenRequest, save: forbiddenRequest } },
    './model': model, './pending': { canRestorePending, decodePending, pendingKey, memoryDrafts }
  }).TransitStudioScreen as ComponentType<{ params: { city: string } }>;
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  const params = { city: 'damascus' };
  try {
    const mount = async (): Promise<void> => { await act(async () => { renderer = create(createElement(screen, { params })); }); };
    await mount();
    const input = (label: string) => renderer!.root.findAll(node => node.type === 'input' && node.props.accessibilityLabel === label)[0]!;
    const arabic = 'اسم المسار بالعربية', notes = 'ملاحظات إضافية';
    expect(renderer!.root.findAll(node => node.type === 'input' && node.props.accessibilityLabel === arabic)).toHaveLength(1);
    expect(input(arabic).props.autoCorrect).toBe(false);
    expect(input(arabic).props.maxLength).toBe(255);
    expect(input(arabic).props.multiline).toBe(false);
    expect(input(notes).props.autoCorrect).toBe(true);
    expect(input(notes).props.multiline).toBe(true);
    expect(input('اسم المسار بالإنجليزية (اختياري)').props.autoCorrect).toBe(true);
    const name = 'مسار تحقق e555f070-8bbf-447f-a700-c4120a273683';
    for (const value of ['مسار', 'مسار ', name]) {
      await act(async () => { input(arabic).props.onChangeText(value); });
      expect(input(arabic).props.value).toBe(value);
      expect(memoryDrafts.get('101:new:damascus')?.nameAr).toBe(value);
    }
    const prose = 'وصف المسار الكامل مع ملاحظات عربية للمراجعة.';
    await act(async () => { input(notes).props.onChangeText(prose); });
    await act(async () => { renderer!.root.findByType('map').props.onCameraChange({ center: { latitude: 33.51, longitude: 36.31 }, zoom: 13 }); });
    expect(input(arabic).props.value).toBe(name);
    expect(input(notes).props.value).toBe(prose);
    await act(async () => { renderer!.unmount(); }); renderer = undefined;
    await mount();
    expect(input(arabic).props.value).toBe(name);
    expect(input(notes).props.value).toBe(prose);
    expect(reads).toEqual([pendingKey, pendingKey]);
    expect(writes).toEqual([]);
    expect(requests).toEqual([]);
  } finally {
    if (renderer) await act(async () => { renderer?.unmount(); });
    const messages = warning.mock.calls.map(call => call[0]); warning.mockRestore();
    expect(messages.every(message => message === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  }
});
