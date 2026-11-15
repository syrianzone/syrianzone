import { expect, spyOn, test } from 'bun:test';
import React, { createElement, type ComponentType, type ReactNode } from 'react';
import { act, create } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import * as model from './model';

const fromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = fromApp('@babel/core');
const code = babel.transformFileSync(fileURLToPath(new URL('./Index.tsx', import.meta.url)), {
  babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'], plugins: ['@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true },
})?.code;
if (!code) throw new Error('The actual Hotel screen did not compile.');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const dto = (id: number, lat: number | null, lng: number | null) => ({ id, name: `Hotel ${id}`, name_ar: `فندق ${id}`, city: 'Homs', city_ar: 'حمص', slug: `hotel-${id}`,
  lat, lng, star_rating: 4, now_show_rate: null, currency: 'SYP', thumb_url: null, source_url: `https://halasyria.com/hotels/hotel-${id}`,
  description: 'Original description', description_ar: 'الوصف الأصلي', images: ['https://example.test/one.jpg', 'https://example.test/two.jpg'] });
type Props = { params: Record<string, string> };
const section = ({ children }: { children: ReactNode }) => createElement(React.Fragment, null, children);

function fixture(wide = false) {
  let data = model.decodeHotel(dto(4, 34.7, 36.6));
  const module = { exports: {} as { HotelScreen?: ComponentType<Props> } };
  runInNewContext(code!, { module, exports: module.exports, Symbol, console,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return fromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { ScrollView: 'scroll', View: 'view', FlatList: 'list' };
      if (name === '../../api') return { api: {} };
      if (name === '../../components') return { AdaptivePanes: ({ primary, secondary, compact }: { primary: ReactNode; secondary?: ReactNode; compact?: ReactNode }) => wide ? createElement(React.Fragment, null, primary, secondary) : compact ?? primary,
        contentStyle: {}, Heading: 'h1', Label: 'label', Photo: 'img', Section: section, RequestStatus: () => null, EmptyState: 'empty' };
      if (name === '../../MapView') return { MapView: 'map' };
      if (name === '../../resource') return { useResource: () => ({ data }) };
      if (name === '../../ui/native') return { NativeAction: 'button', NativeSymbol: 'symbol' };
      if (name === '../../ui/theme') return { useTheme: () => ({ colors: {} }) };
      if (name === '../../platform/features') return { useFeatureNavigation: () => ({ open() { throw new Error('Unexpected navigation.'); } }) };
      if (name === '../../platform/links') return { openExternal() { throw new Error('The source destination must remain explicit and unopened.'); } };
      if (name === '../../platform/usePages') return {};
      if (name === './model') return model;
      throw new Error('Unexpected Hotel screen dependency.');
    },
  });
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  let renderer: ReturnType<typeof create> | null = null;
  return {
    data(value: ReturnType<typeof model.decodeHotel>) { data = value; },
    render(id = 4) {
      act(() => { if (renderer) renderer.update(createElement(module.exports.HotelScreen!, { params: { id: String(id) } }));
        else renderer = create(createElement(module.exports.HotelScreen!, { params: { id: String(id) } })); });
      return renderer!.root;
    },
    close() { if (renderer) act(() => renderer!.unmount());
      expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true); warning.mockRestore(); },
  };
}

test('compact hotel detail exposes exactly its selected validated hotel coordinate and original name', () => {
  const f = fixture();
  try {
    const root = f.render(), maps = root.findAllByType('map');
    expect(maps).toHaveLength(1);
    expect(maps[0]!.props.pins).toEqual([{ id: 'hotel:4', name: 'فندق 4', coordinate: { latitude: 34.7, longitude: 36.6 }, symbol: 'bed.double' }]);
    expect(root.findAllByType('h1').some(node => node.props.children === 'موقع الفندق')).toBe(true);
  } finally { f.close(); }
});
test('wide detail keeps one selected map beside its original detail without mounting duplicate maps', () => {
  const f = fixture(true);
  try { const root = f.render(); expect(root.findAllByType('map')).toHaveLength(1); expect(root.findAllByType('map')[0]!.props.pins[0].id).toBe('hotel:4'); }
  finally { f.close(); }
});
test('missing coordinates and retained data for another route never invent a selected hotel location', () => {
  const f = fixture();
  try {
    expect(f.render().findAllByType('map')).toHaveLength(1);
    expect(f.render(5).findAllByType('map')).toHaveLength(0);
    f.data(model.decodeHotel(dto(5, null, null)));
    const root = f.render(5);
    expect(root.findAllByType('map')).toHaveLength(0);
    expect(root.findAllByType('h1').some(node => node.props.children === 'موقع الفندق')).toBe(false);
    expect(root.findAllByType('button').some(node => node.props.title === 'اقرأ المزيد على HalaSyria')).toBe(true);
    f.data(model.decodeHotel(dto(5, 35.1, 36.2)));
    expect(f.render(5).findAllByType('map')[0]!.props.pins).toEqual([{ id: 'hotel:5', name: 'فندق 5', coordinate: { latitude: 35.1, longitude: 36.2 }, symbol: 'bed.double' }]);
  } finally { f.close(); }
});
test('map context preserves actual gallery next/previous, original description and explicit source action', () => {
  const f = fixture();
  try {
    let root = f.render();
    expect(root.findAllByType('img')[0]!.props.url).toBe('https://example.test/one.jpg');
    act(() => root.findAllByType('button').find(node => node.props.title === 'الصورة التالية')!.props.onPress());
    root = f.render(); expect(root.findAllByType('img')[0]!.props.url).toBe('https://example.test/two.jpg');
    act(() => root.findAllByType('button').find(node => node.props.title === 'الصورة السابقة')!.props.onPress());
    root = f.render(); expect(root.findAllByType('img')[0]!.props.url).toBe('https://example.test/one.jpg');
    expect(root.findAllByType('label').some(node => node.props.children === 'الوصف الأصلي')).toBe(true);
    expect(root.findAllByType('button').filter(node => node.props.title === 'اقرأ المزيد على HalaSyria')).toHaveLength(1);
  } finally { f.close(); }
});
