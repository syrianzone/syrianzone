import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { isCoordinate } from '../../domain';
import * as model from './model';
import { canRestorePending, decodePending, pendingKey } from './pending';

const appRoot = new URL('../../../', import.meta.url);
const requireFromApp = createRequire(new URL('package.json', appRoot));
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
function compiled(url: URL, dependencies: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const code = babel.transformFileSync(fileURLToPath(url), {
    babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
    plugins: ['@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
  })?.code;
  if (!code) throw new Error('Studio map production compilation returned no code.');
  const output = { exports: {} as Record<string, unknown> };
  const vm: typeof import('node:vm') = requireFromApp('node:vm');
  vm.runInNewContext(code, { module: output, exports: output.exports, console, Symbol, AbortController,
    require(name: string): unknown {
      if (name === 'react') return React;
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error('Unexpected Studio map dependency: ' + name);
    }
  });
  return output.exports;
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const colors = { text: '#111', secondary: '#666', danger: '#c00', separator: '#ccc', background: '#fff', surface: '#fff', accent: '#080' };
const native = { View: 'view', Pressable: 'pressable', Text: 'text', TextInput: 'input', ScrollView: 'scroll', Modal: 'modal',
  FlatList: ({ ListHeaderComponent, data, renderItem, keyExtractor }: { ListHeaderComponent?: ReactNode; data: unknown[]; renderItem(value: { item: unknown }): ReactNode; keyExtractor(item: unknown): string }) =>
    createElement('list', null, ListHeaderComponent, ...data.map(item => createElement(React.Fragment, { key: keyExtractor(item) }, renderItem({ item })))),
  StyleSheet: { create: (value: unknown) => value } };
const ui = { NativeAction: 'action', NativeIconAction: 'icon-action', NativePicker: 'picker', NativeToggle: 'toggle', NativeSymbol: 'symbol' };
const mapSource = new URL('src/MapView.tsx', appRoot);
const MapView = compiled(mapSource, {
  'react-native': native, 'expo-maps': { AppleMaps: { View: 'map', MapColorScheme: { DARK: 'dark', LIGHT: 'light' } } },
  './domain': { isCoordinate }, './map-data': { cameraForCoordinates: () => null }, './components': { EmptyState: 'empty' },
  './ui/theme': { useTheme: () => ({ mode: 'light', colors }) }
}).MapView as ComponentType<Record<string, unknown>>;

test('Studio forwards route touches as actual-coordinate map events and creates independently snapped stops', async () => {
  const components = compiled(new URL('src/components.tsx', appRoot), {
    'react-native': native, 'expo-image': { Image: 'image' }, './ui/native': ui, './ui/theme': { useTheme: () => ({ colors }) }, './layout': {}, './NativeLayout': {}
  });
  const memoryDrafts = new Map<string, model.StudioDraft>();
  const requests: unknown[] = [], writes: unknown[] = [];
  const forbiddenRequest = (...args: unknown[]): never => { requests.push(args); throw new Error('Map editing must not send requests.'); };
  const cities = { data: [{ id: 'damascus', nameAr: 'دمشق', status: 'active', coordinates: { latitude: 33.51, longitude: 36.3 }, zoom: 12 }], loading: false, error: null };
  const reference = { data: null, loading: false, error: null };
  let identity = 0;
  const screen = compiled(new URL('src/features/TransitStudio/Index.tsx', appRoot), {
    'react-native': native, 'react-native-safe-area-context': { SafeAreaView: 'safe-area' }, 'expo-crypto': { randomUUID: () => `owned-stop-${++identity}` },
    '../../../../resources/data/transit.json': JSON.parse(readFileSync(new URL('../resources/data/transit.json', appRoot), 'utf8')),
    '../../api': { api: { getSessionGeneration: () => 7 }, ApiError: class extends Error {} },
    '../../components': { ...components, AdaptivePanes: ({ compact }: { compact: ReactNode }) => compact },
    '../../domain': { routeColor: () => '#080' }, '../../MapView': { MapView }, '../../map-data': { cameraForCoordinates: () => null },
    '../../resource': { useResource: (_load: unknown, options?: unknown) => options ? reference : cities },
    '../../platform/account': { useAccount: () => ({ ready: true, busy: false, sessionGeneration: 7, user: { id: 101, effective_permissions: [], transit_scope: null } }) },
    '../../platform/features': { useFeatureNavigation: () => ({ open: forbiddenRequest }) }, '../../platform/lifecycle': { useScreenActive: () => true },
    '../../platform/storage': { readDocument: async () => null, writeDocument: async (...args: unknown[]) => { writes.push(args); throw new Error('Map editing must not write a personal document.'); } },
    '../../ui/native': ui, '../../ui/theme': { useTheme: () => ({ colors }) }, '../../ui/graphics': { ProjectIcon: 'project-icon' },
    '../../platform/transit-client': { transitClient: { cities: forbiddenRequest, network: forbiddenRequest } }, '../../platform/transit-model': {}, '../../platform/geo': {},
    './api': { studioClient: { load: forbiddenRequest, save: forbiddenRequest } }, './model': model,
    './pending': { canRestorePending, decodePending, pendingKey, memoryDrafts }
  }).TransitStudioScreen as ComponentType<{ params: { city: string } }>;
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(createElement(screen, { params: { city: 'damascus' } })); });
    const map = () => renderer!.root.findByType('map');
    expect(map().props.properties?.polylineTapThreshold).toBe(0);
    const press = async (title: string) => { await act(async () => { renderer!.root.findAll(node => String(node.type) === 'action' && node.props.title === title)[0]!.props.onPress(); }); };
    const click = async (coordinate: { latitude: number; longitude: number }) => { await act(async () => { map().props.onMapClick({ coordinates: coordinate }); }); };
    await press('رسم أو إكمال المسار');
    await click({ latitude: 33.51, longitude: 36.29 });
    await click({ latitude: 33.51, longitude: 36.31 });
    expect(map().props.polylines).toHaveLength(1);
    const line = map().props.polylines[0];
    expect(line.coordinates).toEqual([{ latitude: 33.51, longitude: 36.29 }, { latitude: 33.51, longitude: 36.31 }]);
    await press('إضافة موقف على الخريطة');
    await click({ latitude: 33.51, longitude: 36.3 });
    const draft = () => memoryDrafts.get('101:new:damascus')!;
    expect(draft().stops).toHaveLength(1);
    expect(draft().stops[0]!.coordinate).toEqual({ latitude: 33.51, longitude: 36.3 });
    const name = renderer!.root.findAll(node => node.type === 'input' && node.props.accessibilityLabel === 'اسم الموقف');
    expect(name).toHaveLength(1);
    await act(async () => { name[0]!.props.onChangeText('موقف التحقق'); });
    await press('حفظ اسم الموقف');
    expect(draft().stops[0]!.name).toBe('موقف التحقق');
    await press('تم');
    await press('إضافة موقف على الخريطة');
    const nearRoute = { latitude: 33.511, longitude: 36.306 };
    await click(nearRoute);
    expect(draft().stops).toHaveLength(2);
    expect(draft().stops[1]!.coordinate).toEqual(model.nearestOnRoute(draft().segments, nearRoute).coordinate);
    expect(draft().stops[1]!.coordinate.latitude).toBeCloseTo(33.51, 8);
    expect(draft().stops[1]!.coordinate).not.toEqual(nearRoute);
    expect(draft().segments).toHaveLength(1);
    expect(requests).toEqual([]); expect(writes).toEqual([]);
  } finally {
    if (renderer) await act(async () => { renderer!.unmount(); });
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
    warning.mockRestore();
  }
});

test('a transit line handler retains native default hit testing and receives its original route id', async () => {
  const lineCalls: string[] = [], mapCalls: unknown[] = [];
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReactTestRenderer | undefined;
  try {
    await act(async () => { renderer = create(createElement(MapView, {
      pins: [], camera: { coordinates: { latitude: 33.51, longitude: 36.3 }, zoom: 12 },
      lines: [{ id: 'reference:owned-route:0', coordinates: [{ latitude: 33.51, longitude: 36.29 }, { latitude: 33.51, longitude: 36.31 }], color: '#080' }],
      onLinePress: (id: string) => { lineCalls.push(id); }, onMapPress: (coordinate: unknown) => { mapCalls.push(coordinate); }
    })); });
    const map = renderer!.root.findByType('map');
    expect(map.props.properties).toBeUndefined();
    await act(async () => { map.props.onPolylineClick({ id: 'reference:owned-route:0', coordinates: [{ latitude: 33.51, longitude: 36.29 }, { latitude: 33.51, longitude: 36.31 }] }); });
    expect(lineCalls).toEqual(['reference:owned-route:0']); expect(mapCalls).toEqual([]);
  } finally {
    if (renderer) await act(async () => { renderer!.unmount(); });
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
    warning.mockRestore();
  }
});
