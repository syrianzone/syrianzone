import { afterEach, expect, spyOn, test } from 'bun:test';
import React, { createContext, createElement, useContext, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { Deferred } from '../node_modules/@react-navigation/bottom-tabs/src/unstable/Deferred';
import * as links from './platform/app-links';
import type { FeatureNavigation } from './platform/features';
import type { RootRoutes, TabRoutes } from './navigation';

const requireFromApp = createRequire(import.meta.url);
const babel: { transformFileSync(path: string, options: Record<string, unknown>): { code?: string | null } | null } = requireFromApp('@babel/core');
// Opt into the installed Babel CommonJS plugin's own dynamic-import transform
// so the production-compiled App can execute its async imports in this VM.
const dynamicImports = () => ({ pre(file: { set(key: string, value: unknown): void }) { file.set('@babel/plugin-proposal-dynamic-import', true); } });
const code = babel.transformFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), {
  babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
  plugins: [dynamicImports, '@babel/plugin-transform-modules-commonjs'],
  caller: { name: 'metro', bundler: 'metro', platform: 'ios', isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
})?.code;
if (!code) throw new Error('Production App compilation returned no code.');
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mounted: ReactTestRenderer[] = [];
afterEach(async () => { await act(async () => { for (const renderer of mounted.splice(0)) renderer.unmount(); }); });

type Route = { name: keyof RootRoutes | keyof TabRoutes; key: string; params?: Record<string, unknown> };
interface Selection { stack: Route; tab: Route }
interface ScreenProps { name: string; component: ComponentType<Record<string, unknown>>; options?: { lazy?: boolean } }
interface NavigatorProps { children: ReactNode; screenOptions?: { lazy?: boolean } }
const initial: Selection = { stack: { name: 'Main', key: 'main' }, tab: { name: 'Home', key: 'home' } };
const passthrough = ({ children }: { children: ReactNode }) => createElement(React.Fragment, null, children);
const colors = { background: '#fff', surface: '#fff', text: '#000', accent: '#080', secondary: '#555', separator: '#ddd' };

function harness() {
  const SelectionContext = createContext(initial), RouteContext = createContext(initial.stack);
  const evaluated: string[] = [], cache = new Map<string, unknown>(), stackOptions = new Map<string, unknown>();
  const navigations: unknown[][] = [], browserUrls: string[] = [];
  let featureNavigation: FeatureNavigation | undefined;
  let current = initial, containerProps: Record<string, unknown> = {};
  const navigation = { isReady: () => true, getCurrentRoute: () => current.stack.name === 'Main' ? current.tab : current.stack, canGoBack: () => false, goBack() {},
    navigate: (...args: unknown[]) => { navigations.push(args); }, replace() {} };
  const useRoute = () => useContext(RouteContext);
  function StackNavigator({ children }: NavigatorProps): ReactNode {
    const selection = useContext(SelectionContext);
    const screens = React.Children.toArray(children) as ReactElement<ScreenProps>[];
    for (const screen of screens) stackOptions.set(screen.props.name, screen.props.options);
    const screen = screens.find(child => child.props.name === selection.stack.name);
    if (!screen) throw new Error('The configured stack route is missing.');
    return createElement(RouteContext.Provider, { value: selection.stack }, createElement(screen.props.component, { route: selection.stack, navigation }));
  }
  function TabNavigator({ children, screenOptions }: NavigatorProps): ReactNode {
    const selection = useContext(SelectionContext);
    return React.Children.map(children, child => {
      const screen = child as ReactElement<ScreenProps>;
      const visible = screen.props.name === selection.tab.name;
      const route: Route = visible ? selection.tab : { name: screen.props.name as keyof TabRoutes, key: screen.props.name };
      // Use the installed native tab's real visibility/deferred-render policy.
      return createElement(Deferred, { lazy: screen.props.options?.lazy ?? screenOptions?.lazy ?? false, visible,
        children: createElement(RouteContext.Provider, { value: route }, createElement(screen.props.component, { route, navigation })) });
    });
  }
  function FixturePage({ kind }: { kind: string }): ReactNode {
    const route = useRoute(), [count, setCount] = useState(0);
    return createElement('fixture-page', { kind, route, count, increment: () => setCount(value => value + 1) });
  }
  const exportsFor = (path: string): unknown => {
    if (!cache.has(path)) {
      evaluated.push(path);
      cache.set(path, path === './transit' ? {
        TransitScreen: () => createElement(FixturePage, { kind: 'transit' }),
        TransitCityScreen: (props: Record<string, unknown>) => createElement('fixture-city', props)
      } : {
        PlacesScreen: () => createElement(FixturePage, { kind: 'places' }),
        SavedScreen: () => createElement(FixturePage, { kind: 'saved' }),
        PlaceScreen: () => createElement(FixturePage, { kind: 'place' })
      });
    }
    return cache.get(path);
  };
  const module = { exports: {} as { default?: ComponentType } };
  runInNewContext(code!, {
    module, exports: module.exports, Symbol, console, Promise,
    require(name: string): unknown {
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { ActivityIndicator: 'loading', ScrollView: 'scroll', View: 'view', Platform: { OS: 'ios', Version: 27 }, useColorScheme: () => 'light' };
      if (name === '@react-navigation/native') return {
        NavigationContainer: (props: Record<string, unknown> & { children: ReactNode }) => { containerProps = props; return props.children; },
        DarkTheme: { colors: {} }, DefaultTheme: { colors: {} }, useNavigationContainerRef: () => navigation, useRoute
      };
      if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator: StackNavigator, Screen: () => null }) };
      if (name === '@react-navigation/bottom-tabs/unstable') return { createNativeBottomTabNavigator: () => ({ Navigator: TabNavigator, Screen: () => null }) };
      if (name === 'react-native-safe-area-context') return { SafeAreaProvider: passthrough };
      if (name === 'expo-web-browser') return { openBrowserAsync: async (url: string) => { browserUrls.push(url); } };
      if (name === './components') return { AdaptivePanes: ({ primary }: { primary: ReactNode }) => primary, contentStyle: {}, EmptyState: 'empty', Heading: 'heading', Label: 'label', RequestStatus: 'status', Section: 'section' };
      if (name === './state') return { StateProvider: passthrough, useAppState: () => ({ ready: true, storageAvailable: true }), useNativeAppearance() {} };
      if (name === './ui/native') return { NativeAction: 'action', NativeSegmented: 'segments', NativeSymbol: 'symbol' };
      if (name === './ui/theme') return { ThemeProvider: passthrough, themeColors: { light: colors }, useTheme: () => ({ colors, mode: 'light' }) };
      if (name === './transit' || name === './places') return exportsFor(name);
      if (name === './features/Home/Index') return { HomeScreen: () => createElement('home') };
      if (name === './platform/features') return { FeatureNavigationProvider: ({ value, children }: { value: FeatureNavigation; children: ReactNode }) => {
        featureNavigation = value;
        return children;
      } };
      if (name === './platform/storage') return { writeDocument: async () => {} };
      if (name === './platform/account') return { AccountProvider: passthrough };
      if (name === './platform/audio') return { AudioProvider: passthrough, useQuranPlayer: () => ({ source: 'continuous', current: null }) };
      if (name === './platform/AudioMiniPlayer') return { AudioMiniPlayer: () => null, AudioMiniPlayerButton: () => null, AudioMiniPlayerSheet: () => null };
      if (name === './feature-registry') return { featureScreens: {} };
      if (name === './platform/feature-location') return { featureParameters: (value: unknown) => value };
      if (name === './platform/SitePopupPublic') return { SitePopupPublic: 'campaign' };
      if (name === './platform/app-links') return links;
      if (name === './platform/site-origin') return { configuredSiteOrigin: 'https://syrian.zone' };
      if (name === './platform/transit-client') return { transitClient: {} };
      if (name === './resource') return { useResource: () => ({ data: null }) };
      if (name === './platform/lifecycle') return { useScreenActive: () => false };
      throw new Error('Unexpected App dependency: ' + name);
    }
  });
  const App = module.exports.default!;
  let renderer: ReactTestRenderer | undefined;
  const element = () => createElement(SelectionContext.Provider, { value: current }, createElement(App));
  return {
    evaluated, stackOptions, navigations, browserUrls,
    get featureNavigation() { if (!featureNavigation) throw new Error('Render the App first.'); return featureNavigation; },
    get renderer() { if (!renderer) throw new Error('Render the App first.'); return renderer; },
    get container() { return containerProps; },
    render(selection = initial) {
      current = selection;
      act(() => { if (renderer) renderer.update(element()); else { renderer = create(element()); mounted.push(renderer); } });
    },
    async settle() { await act(async () => { await Promise.resolve(); }); }
  };
}

async function checked(run: () => Promise<void>): Promise<void> {
  const warning = spyOn(console, 'error').mockImplementation(() => {});
  try {
    await run();
    expect(warning.mock.calls.every(call => call[0] === 'react-test-renderer is deprecated. See https://react.dev/warnings/react-test-renderer')).toBe(true);
  } finally { warning.mockRestore(); }
}
const nodes = (renderer: ReactTestRenderer, kind: string) => renderer.root.findAll(node => node.type === kind);

test('Home evaluates neither map route module and keeps the navigation ref and campaign mounted', async () => checked(async () => {
  const app = harness();
  expect(app.evaluated).toEqual([]);
  app.render();
  await app.settle();
  expect(app.evaluated).toEqual([]);
  expect(nodes(app.renderer, 'home')).toHaveLength(1);
  expect(nodes(app.renderer, 'campaign')).toHaveLength(1);
  expect(app.container.ref).toBeDefined();
  const linking = app.container.linking as { getStateFromPath(path: string): unknown };
  expect(linking.getStateFromPath('place/201')).toEqual(links.appStateFromPath('place/201', []));
}));

test('catalogue actions use saved destinations independently of their item identifiers', async () => checked(async () => {
  const app = harness();
  app.render();
  await act(async () => {
    await app.featureNavigation.openCatalogueLink('/mishwar', 'markets');
    await app.featureNavigation.openCatalogueLink('/mishwar?category=market', 'markets');
  });
  expect(app.navigations).toEqual([['Main', { screen: 'Places', params: {} }]]);
  expect(app.browserUrls).toEqual(['https://syrian.zone/mishwar?category=market']);
}));

test('first Transit access shows accessible loading then reuses its module and local tab state', async () => checked(async () => {
  const app = harness();
  app.render();
  await app.settle();
  const transit: Selection = { ...initial, tab: { name: 'Transit', key: 'transit' } };
  app.render(transit);
  expect(nodes(app.renderer, 'loading').some(node => node.props.accessibilityLabel === 'جارٍ فتح القسم')).toBe(true);
  await app.settle();
  expect(app.evaluated).toEqual(['./transit']);
  const page = nodes(app.renderer, 'fixture-page').find(node => node.props.kind === 'transit')!;
  act(() => page.props.increment());
  expect(page.props.count).toBe(1);
  app.render(initial);
  await app.settle();
  app.render(transit);
  await app.settle();
  expect(app.evaluated).toEqual(['./transit']);
  expect(nodes(app.renderer, 'fixture-page').find(node => node.props.kind === 'transit')?.props.count).toBe(1);
}));

test('cold Places selection preserves link params and changed filters reset only its local screen', async () => checked(async () => {
  const app = harness();
  const places: Selection = { ...initial, tab: { name: 'Places', key: 'places', params: { q: 'دمشق', view: 'list', tab: 'mine' } } };
  app.render(places);
  await app.settle();
  expect(app.evaluated).toEqual(['./places']);
  let page = nodes(app.renderer, 'fixture-page').find(node => node.props.kind === 'places')!;
  expect(page.props.route.params).toEqual(places.tab.params);
  act(() => page.props.increment());
  expect(page.props.count).toBe(1);
  const changed: Selection = { ...places, tab: { ...places.tab, params: { q: 'حلب', view: 'photos' } } };
  app.render(changed);
  await app.settle();
  page = nodes(app.renderer, 'fixture-page').find(node => node.props.kind === 'places')!;
  expect(page.props.route.params).toEqual(changed.tab.params);
  expect(page.props.count).toBe(0);
  expect(app.evaluated).toEqual(['./places']);
}));

test('cold place details and Saved first access share one Places module without loading Transit', async () => checked(async () => {
  const app = harness();
  const detail: Selection = { ...initial, stack: { name: 'Place', key: 'detail', params: { id: 201, snapshot: { id: 201, name: 'محفوظ محلي' } } } };
  app.render(detail);
  await app.settle();
  expect(app.evaluated).toEqual(['./places']);
  expect(nodes(app.renderer, 'fixture-page')[0]?.props.route.params).toEqual(detail.stack.params);
  app.render({ ...initial, tab: { name: 'Saved', key: 'saved' } });
  await app.settle();
  expect(nodes(app.renderer, 'fixture-page').some(node => node.props.kind === 'saved')).toBe(true);
  expect(app.evaluated).toEqual(['./places']);
}));

test('cold TransitCity selection forwards its city route id initial view and navigation unchanged', async () => checked(async () => {
  const app = harness();
  const city: Selection = { ...initial, stack: { name: 'TransitCity', key: 'city', params: { city: { id: 'damascus', nameAr: 'دمشق' }, routeId: 'route-7', initialView: 'map' } } };
  app.render(city);
  await app.settle();
  expect(app.evaluated).toEqual(['./transit']);
  const page = nodes(app.renderer, 'fixture-city')[0]!;
  expect(page.props.route).toBe(city.stack);
  expect(page.props.navigation.isReady()).toBe(true);
}));

test('only 2048 disables content-wide dismissal while other feature routes keep their inherited native defaults', async () => checked(async () => {
  const app = harness(); app.render(); await app.settle();
  const options = app.stackOptions.get('Feature');
  expect(typeof options).toBe('function');
  if (typeof options !== 'function') throw new Error('The actual Feature route must expose its configured options.');
  const game = options({ route: { params: { section: '2048' } } }) as Record<string, unknown>;
  expect(game.fullScreenGestureEnabled).toBe(false);
  expect(Object.hasOwn(game, 'gestureEnabled')).toBe(false);
  for (const section of ['about', 'solitare', 'tarneeb', 'trix']) {
    const other = options({ route: { params: { section } } }) as Record<string, unknown>;
    expect(Object.hasOwn(other, 'fullScreenGestureEnabled')).toBe(false);
    expect(Object.hasOwn(other, 'gestureEnabled')).toBe(false);
  }
}));
