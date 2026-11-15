import { afterEach, expect, spyOn, test } from 'bun:test';
import React, { createContext, createElement, useContext, useState, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { Deferred } from '../node_modules/@react-navigation/bottom-tabs/src/unstable/Deferred';
import * as links from './platform/app-links';
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
interface NavigatorProps {
  children: ReactNode;
  screenLayout?: (props: { children: ReactNode }) => ReactNode;
  screenOptions?: { lazy?: boolean; bottomAccessory?: (props: { placement: 'regular' | 'inline' }) => ReactNode };
}
const initial: Selection = { stack: { name: 'Main', key: 'main' }, tab: { name: 'Home', key: 'home' } };
const passthrough = ({ children }: { children: ReactNode }) => createElement(React.Fragment, null, children);
const colors = { background: '#fff', surface: '#fff', text: '#000', accent: '#080', secondary: '#555', separator: '#ddd' };

interface PlayerState { source: 'continuous' | 'reader'; current: { surah: number; ayah: number } | null; seconds: number }
const emptyPlayer: PlayerState = { source: 'continuous', current: null, seconds: 0 };
function harness(platform = { OS: 'ios', Version: 27 }) {
  const SelectionContext = createContext(initial), RouteContext = createContext(initial.stack), PlayerContext = createContext(emptyPlayer);
  let player = emptyPlayer, tabOptions: NavigatorProps['screenOptions'];
  const evaluated: string[] = [], cache = new Map<string, unknown>(), stackOptions = new Map<string, unknown>();
  let current = initial, containerProps: Record<string, unknown> = {};
  const navigation = { isReady: () => true, getCurrentRoute: () => current.stack.name === 'Main' ? current.tab : current.stack, canGoBack: () => false, goBack() {}, navigate() {}, replace() {} };
  const useRoute = () => useContext(RouteContext);
  function StackNavigator({ children }: NavigatorProps): ReactNode {
    const selection = useContext(SelectionContext);
    const screens = React.Children.toArray(children) as ReactElement<ScreenProps>[];
    for (const screen of screens) stackOptions.set(screen.props.name, screen.props.options);
    const screen = screens.find(child => child.props.name === selection.stack.name);
    if (!screen) throw new Error('The configured stack route is missing.');
    return createElement(RouteContext.Provider, { value: selection.stack }, createElement(screen.props.component, { route: selection.stack, navigation }));
  }
  function TabNavigator({ children, screenOptions, screenLayout }: NavigatorProps): ReactNode {
    tabOptions = screenOptions;
    const selection = useContext(SelectionContext);
    const pages = React.Children.map(children, child => {
      const screen = child as ReactElement<ScreenProps>;
      const visible = screen.props.name === selection.tab.name;
      const route: Route = visible ? selection.tab : { name: screen.props.name as keyof TabRoutes, key: screen.props.name };
      // Use the installed native tab's real visibility/deferred-render policy.
      return createElement(Deferred, { lazy: screen.props.options?.lazy ?? screenOptions?.lazy ?? false, visible,
        children: createElement(RouteContext.Provider, { value: route }, screenLayout
          ? screenLayout({ children: createElement(screen.props.component, { route, navigation }) })
          : createElement(screen.props.component, { route, navigation })) });
    });
    return createElement(React.Fragment, null, pages, screenOptions?.bottomAccessory
      ? createElement('native-tab-accessory', null, screenOptions.bottomAccessory({ placement: 'regular' }), screenOptions.bottomAccessory({ placement: 'inline' })) : null);
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
  const platformCode = platform.OS === 'ios' ? code : babel.transformFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), {
    babelrc: false, configFile: false, envName: 'production', presets: ['babel-preset-expo'],
    plugins: [dynamicImports, '@babel/plugin-transform-modules-commonjs'],
    caller: { name: 'metro', bundler: 'metro', platform: platform.OS, isDev: false, isServer: false, isNodeModule: false, supportsStaticESM: true, supportsReactCompiler: true }
  })?.code;
  if (!platformCode) throw new Error('Actual platform App compilation returned no code.');
  runInNewContext(platformCode, {
    module, exports: module.exports, Symbol, console, Promise,
    require(request: string): unknown {
      const name = request;
      if (name.startsWith('@babel/runtime/') || name === 'react/compiler-runtime' || name === 'react/jsx-runtime') return requireFromApp(name);
      if (name === 'react') return React;
      if (name === 'react-native') return { ActivityIndicator: 'loading', ScrollView: 'scroll', View: 'view', Platform: platform, useColorScheme: () => 'light' };
      if (name === '@react-navigation/native') return {
        NavigationContainer: (props: Record<string, unknown> & { children: ReactNode }) => { containerProps = props; return props.children; },
        DarkTheme: { colors: {} }, DefaultTheme: { colors: {} }, useNavigationContainerRef: () => navigation, useRoute
      };
      if (name === '@react-navigation/native-stack') return { createNativeStackNavigator: () => ({ Navigator: StackNavigator, Screen: () => null }) };
      if (name === '@react-navigation/bottom-tabs/unstable') return { createNativeBottomTabNavigator: () => ({ Navigator: TabNavigator, Screen: () => null }) };
      if (name === 'react-native-safe-area-context') return { SafeAreaProvider: passthrough };
      if (name === './components') return { AdaptivePanes: ({ primary }: { primary: ReactNode }) => primary, contentStyle: {}, EmptyState: 'empty', Heading: 'heading', Label: 'label', RequestStatus: 'status', Section: 'section' };
      if (name === './state') return { StateProvider: passthrough, useAppState: () => ({ ready: true, storageAvailable: true }), useNativeAppearance() {} };
      if (name === './ui/native') return { NativeAction: 'action', NativeSegmented: 'segments', NativeSymbol: 'symbol' };
      if (name === './ui/theme') return { ThemeProvider: passthrough, themeColors: { light: colors }, useTheme: () => ({ colors, mode: 'light' }) };
      if (name === './transit' || name === './places') return exportsFor(name);
      if (name === './features/Home/Index') return { HomeScreen: () => createElement('home') };
      if (name === './platform/features') return { FeatureNavigationProvider: passthrough };
      if (name === './platform/storage') return { writeDocument: async () => {} };
      if (name === './platform/account') return { AccountProvider: passthrough };
      if (name === './platform/audio') return { AudioProvider: passthrough, useQuranPlayer: () => useContext(PlayerContext) };
      if (name === './platform/AudioMiniPlayer') return { AudioMiniPlayer: (props: { hidden?: boolean }) => createElement('audio-mini', props), AudioMiniPlayerButton: (props: { onPress(): void; compact?: boolean }) => createElement('audio-mini-button', props), AudioMiniPlayerSheet: (props: { visible: boolean; onClose(): void }) => createElement('audio-mini-sheet', props) };
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
  const element = () => createElement(PlayerContext.Provider, { value: player }, createElement(SelectionContext.Provider, { value: current }, createElement(App)));
  return {
    evaluated, stackOptions,
    get tabOptions() { return tabOptions; },
    setPlayer(value: PlayerState) { player = value; this.render(current); },
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

test('iOS26+ uses two native buttons and one shared sheet with no stale queue or placement state', async () => checked(async () => {
  for (const version of [26, 27]) {
    const app = harness({ OS: 'ios', Version: version });
    app.render(); await app.settle();
    expect(app.tabOptions?.bottomAccessory).toBeUndefined();
    app.setPlayer({ source: 'continuous', current: { surah: 1, ayah: 1 }, seconds: 0 }); await app.settle();
    expect(typeof app.tabOptions?.bottomAccessory).toBe('function');
    expect(nodes(app.renderer, 'native-tab-accessory')).toHaveLength(1);
    expect(nodes(app.renderer, 'audio-mini')).toHaveLength(0);
    const buttons = nodes(app.renderer, 'audio-mini-button');
    expect(buttons).toHaveLength(2);
    expect(buttons.map(button => button.props.compact)).toEqual([false, true]);
    expect(buttons[0]!.props.onPress).toBe(buttons[1]!.props.onPress);
    const regularPress = buttons[0]!.props.onPress as () => void;
    const inlinePress = buttons[1]!.props.onPress as () => void;
    expect(nodes(app.renderer, 'audio-mini-sheet')).toHaveLength(1);
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(false);
    act(() => regularPress());
    expect(nodes(app.renderer, 'audio-mini-sheet')).toHaveLength(1);
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(true);
    act(() => inlinePress());
    expect(nodes(app.renderer, 'audio-mini-sheet')).toHaveLength(1);
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(true);
    const callback = app.tabOptions!.bottomAccessory;
    app.setPlayer({ source: 'continuous', current: { surah: 1, ayah: 1 }, seconds: 12 }); await app.settle();
    expect(app.tabOptions?.bottomAccessory).toBe(callback);
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(true);
    app.setPlayer({ source: 'reader', current: { surah: 1, ayah: 1 }, seconds: 12 }); await app.settle();
    expect(app.tabOptions?.bottomAccessory).toBeUndefined();
    expect(nodes(app.renderer, 'audio-mini-button')).toHaveLength(0);
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(false);
    act(() => regularPress());
    app.setPlayer({ source: 'continuous', current: { surah: 1, ayah: 1 }, seconds: 12 }); await app.settle();
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(false);
    act(() => nodes(app.renderer, 'audio-mini-button')[1]!.props.onPress());
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(true);
    act(() => nodes(app.renderer, 'audio-mini-sheet')[0]!.props.onClose());
    expect(nodes(app.renderer, 'audio-mini-sheet')[0]!.props.visible).toBe(false);
    app.setPlayer(emptyPlayer); await app.settle();
    expect(app.tabOptions?.bottomAccessory).toBeUndefined();
    expect(nodes(app.renderer, 'native-tab-accessory')).toHaveLength(0);
  }
}));

test('older iOS and Android retain existing screen-layout mini without a native accessory', async () => checked(async () => {
  for (const platform of [{ OS: 'ios', Version: 25 }, { OS: 'android', Version: 36 }]) {
    const app = harness(platform);
    app.render(); await app.settle();
    app.setPlayer({ source: 'continuous', current: { surah: 1, ayah: 1 }, seconds: 0 }); await app.settle();
    expect(app.tabOptions?.bottomAccessory).toBeUndefined();
    expect(nodes(app.renderer, 'native-tab-accessory')).toHaveLength(0);
    expect(nodes(app.renderer, 'audio-mini').length).toBeGreaterThan(0);
  }
}));
