import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View, useColorScheme } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme, useNavigationContainerRef, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Section } from './components';
import { useAppState, StateProvider, useNativeAppearance } from './state';
import { NativeAction, NativeSegmented, NativeSymbol } from './ui/native';
import { ThemeProvider, themeColors, useTheme } from './ui/theme';
import type { RootRoutes, TabRoutes } from './navigation';
import { HomeScreen } from './features/Home/Index';
import { FeatureNavigationProvider } from './platform/features';
import { writeDocument } from './platform/storage';
import { AccountProvider } from './platform/account';
import { featureScreens } from './feature-registry';
import { featureParameters } from './platform/feature-location';
import { SitePopupPublic } from './platform/SitePopupPublic';
import { appPathFromState, appStateFromPath, catalogueDestination, featureRouteId, parameterIdentity, resolveTransitLink, targetForSection, type AppLinkTarget } from './platform/app-links';
import { configuredSiteOrigin } from './platform/site-origin';
import { transitClient } from './platform/transit-client';
import { useResource } from './resource';
import { useScreenActive } from './platform/lifecycle';

const Stack = createNativeStackNavigator<RootRoutes>();
const Tabs = createNativeBottomTabNavigator<TabRoutes>();
const LazyTransit = lazy(() => import('./transit').then(module => ({ default: module.TransitScreen })));
const LazyTransitCity = lazy(() => import('./transit').then(module => ({ default: module.TransitCityScreen })));
const LazyPlaces = lazy(() => import('./places').then(module => ({ default: module.PlacesScreen })));
const LazyPlace = lazy(() => import('./places').then(module => ({ default: module.PlaceScreen })));
const LazySaved = lazy(() => import('./places').then(module => ({ default: module.SavedScreen })));

function RouteLoading(): React.JSX.Element {
  return <ActivityIndicator accessibilityLabel="جارٍ فتح القسم" style={{ flex: 1 }} />;
}
function TransitScreen(): React.JSX.Element {
  return <Suspense fallback={<RouteLoading />}><LazyTransit /></Suspense>;
}
function TransitCityScreen(props: NativeStackScreenProps<RootRoutes, 'TransitCity'>): React.JSX.Element {
  return <Suspense fallback={<RouteLoading />}><LazyTransitCity {...props} /></Suspense>;
}
function PlaceScreen(): React.JSX.Element {
  return <Suspense fallback={<RouteLoading />}><LazyPlace /></Suspense>;
}
function SavedScreen(): React.JSX.Element {
  return <Suspense fallback={<RouteLoading />}><LazySaved /></Suspense>;
}

// Tab routes keep one navigation entry. Reset view-local filters for each link.
function LinkedPlacesScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<TabRoutes, 'Places'>>();
  return <Suspense fallback={<RouteLoading />}><LazyPlaces key={parameterIdentity(route.params ?? {})} /></Suspense>;
}

function TransitLinkScreen({ route, navigation }: NativeStackScreenProps<RootRoutes, 'TransitLink'>): React.JSX.Element {
  const active = useScreenActive();
  const { cityId, routeId, initialView } = route.params;
  const resource = useResource(useCallback(async (signal: AbortSignal) => resolveTransitLink({ cityId, ...(routeId ? { routeId } : {}), ...(initialView ? { initialView } : {}) }, await transitClient.cities(signal)), [cityId, routeId, initialView]));
  useEffect(() => { if (active && resource.data) navigation.replace('TransitCity', resource.data); }, [active, resource.data, navigation]);
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><Heading>جارٍ فتح المدينة</Heading><RequestStatus resource={resource} /></ScrollView>} />;
}

function FeatureScreen({ route }: NativeStackScreenProps<RootRoutes, 'Feature'>): React.JSX.Element {
  const entry = featureScreens[route.params.section];
  if (!entry) return <EmptyState title="تعذر فتح القسم" detail="افتح القسم من الرئيسية أو تحقق من الرابط." />;
  let params: Record<string, string>;
  try { params = featureParameters(route.params); }
  catch { return <EmptyState title="الرابط غير صالح" detail="افتح القسم من الرئيسية." />; }
  const Component = entry.component;
  return <View style={{ flex: 1 }}><Suspense fallback={<RouteLoading />}><Component params={params} /></Suspense>
</View>;
}

function SettingsScreen(): React.JSX.Element {
  const { mode, colors } = useTheme();
  const state = useAppState();
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>
    <Heading subtitle="إعدادات هذا الجهاز">الإعدادات</Heading>
    <Section><Label style={{ fontWeight: '700' }}>المظهر</Label>
      <NativeSegmented value={mode} disabled={state.busy || !state.storageAvailable} onChange={value => { void state.setAppearance(value); }}
        label="المظهر" options={[{ label: 'فاتح', value: 'light' }, { label: 'داكن', value: 'dark' }]} />
      <Label secondary>يبدأ التطبيق بمظهر النظام. يُحفظ اختيارك على هذا الجهاز.</Label>
    </Section>
    <Section><NativeSymbol name="iphone" /><Label style={{ fontWeight: '700' }}>بياناتك على جهازك</Label>
      <Label secondary>الأماكن المحفوظة متاحة هنا من دون حساب. لا تتم مزامنتها مع الموقع أو الأجهزة الأخرى.</Label>
      <Label secondary>نطلب موقعك عندما تختار عرض المحطات القريبة فقط.</Label>
    </Section>
    {state.error ? <Label style={{ color: colors.danger }}>{state.error}</Label> : null}
    <Section><Label style={{ fontWeight: '700' }}>المساحة السورية</Label><Label secondary>جهد مفتوح المصدر، يبنيه المجتمع.</Label><Label secondary>الإصدار 0.1.0</Label></Section>
  </ScrollView>} />;
}

function MainTabs(): React.JSX.Element {
  const { colors } = useTheme();
  return <Tabs.Navigator screenOptions={{ headerShown: true, headerTintColor: colors.accent, headerStyle: { backgroundColor: colors.background },
    tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.secondary, tabBarControllerMode: 'tabSidebar', tabBarSidebarPreferredPlacement: 'sidebar' }}>
    <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'المساحة السورية', tabBarLabel: 'الرئيسية', tabBarIcon: { type: 'sfSymbol', name: 'house' } }} />
    <Tabs.Screen name="Transit" component={TransitScreen} options={{ lazy: true, title: 'ترانزيت', tabBarIcon: { type: 'sfSymbol', name: 'bus' } }} />
    <Tabs.Screen name="Places" component={LinkedPlacesScreen} options={{ lazy: true, title: 'مشوار', tabBarIcon: { type: 'sfSymbol', name: 'map' } }} />
    <Tabs.Screen name="Saved" component={SavedScreen} options={{ lazy: true, title: 'المحفوظات', tabBarIcon: { type: 'sfSymbol', name: 'bookmark' } }} />
    <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: 'الإعدادات', tabBarIcon: { type: 'sfSymbol', name: 'gearshape' } }} />
  </Tabs.Navigator>;
}

function Application(): React.JSX.Element {
  const state = useAppState();
  const system = useColorScheme();
  const mode = state.appearance ?? (system === 'dark' ? 'dark' : 'light');
  useNativeAppearance(mode);
  return <ThemeProvider mode={mode}><View style={{ flex: 1, backgroundColor: themeColors[mode].background }}>
    {state.ready ? <View style={{ flex: 1 }}>
      {!state.storageAvailable ? <Section><Label>{state.error}</Label><NativeAction title="إعادة المحاولة" onPress={state.retry} /></Section> : null}
      <Navigation />
    </View> : <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
      <EmptyState symbol="externaldrive" title={state.error ?? 'جارٍ قراءة بياناتك'} />
      {state.error ? <NativeAction title="إعادة المحاولة" onPress={state.retry} /> : null}
    </View>}
  </View></ThemeProvider>;
}

function Navigation(): React.JSX.Element {
  const { colors, mode } = useTheme();
  const navigation = useNavigationContainerRef<RootRoutes>();
  const [error, setError] = useState<string | null>(null);
  const [popupPage, setPopupPage] = useState({ key: 'Home', suppressed: false });
  const [interaction, setInteraction] = useState(0);
  const updatePage = () => {
    const route = navigation.getCurrentRoute();
    const section = route?.name === 'Feature' ? (route.params as RootRoutes['Feature']).section : route?.name ?? 'Home';
    setPopupPage({ key: `${section}:${route?.key ?? ''}`, suppressed: section === 'Transit' || section === 'TransitCity' || section === 'TransitLink'
      || section === 'transit' || section === 'transit_studio' || section === 'transit_admin' });
  };
  const openTarget = useCallback(async (target: AppLinkTarget, id: string) => {
    setError(null);
    if (!navigation.isReady()) return;
    if (target.kind === 'place') navigation.navigate('Place', { id: target.id });
    else if (target.kind === 'transit') navigation.navigate('TransitLink', target.params);
    else if (target.kind === 'tab') {
      if (target.tab === 'Places') navigation.navigate('Main', { screen: 'Places', params: target.params ?? {} });
      else navigation.navigate('Main', { screen: target.tab });
    } else navigation.navigate('Feature', { section: target.section, params: target.params });
    await writeDocument('last-visited.v1', id);
  }, [navigation]);
  const open = useCallback((section: string, params: Record<string, string> = {}) => {
    const target = targetForSection(section, params, Object.keys(featureScreens));
    if (!target) { setError('الرابط غير صالح. افتح القسم من الرئيسية.'); return; }
    void openTarget(target, section).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح القسم.'));
  }, [openTarget]);
  const openCatalogueLink = useCallback(async (href: string, id: string) => {
    const target = catalogueDestination(href, Object.keys(featureScreens));
    if (target.kind === 'website') {
      const { openBrowserAsync } = await import('expo-web-browser');
      await openBrowserAsync(target.url);
    } else await openTarget(target, id);
  }, [openTarget]);
  const featureNavigation = useMemo(() => ({
    open, openCatalogueLink,
    canOpen: (section: string, params?: Record<string, string>) => targetForSection(section, params, Object.keys(featureScreens)) !== null,
    back: () => { if (navigation.canGoBack()) navigation.goBack(); }
  }), [open, openCatalogueLink, navigation]);
  const linking = useMemo(() => ({ prefixes: [...new Set(['syrianzone://', 'https://syrian.zone/', `${configuredSiteOrigin}/`])],
    config: { initialRouteName: 'Main' as const, screens: { Main: { path: '', screens: { Home: '', Transit: 'transit', Places: 'places', Saved: 'saved', Settings: 'settings' } }, Feature: 'feature/:section', Place: 'place/:id', TransitLink: 'transit/city/:cityId' } },
    getStateFromPath: (path: string) => appStateFromPath(path, Object.keys(featureScreens)),
    getPathFromState: appPathFromState,
  }), []);
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return <NavigationContainer<RootRoutes> ref={navigation} onReady={updatePage} onStateChange={updatePage} linking={linking} theme={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.accent, border: colors.separator } }}>
    <FeatureNavigationProvider value={featureNavigation}>
    <View style={{ flex: 1 }} onTouchStart={() => setInteraction(value => value + 1)}>
    {error ? <Section><Label>{error}</Label><NativeAction title="إغلاق" onPress={() => setError(null)} /></Section> : null}
    <Stack.Navigator screenOptions={{ headerTintColor: colors.accent, headerBackTitle: 'رجوع', statusBarStyle: mode === 'dark' ? 'light' : 'dark', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false, title: 'المساحة السورية' }} />
      <Stack.Screen name="TransitLink" component={TransitLinkScreen} getId={({ params }) => parameterIdentity({ cityId: params.cityId, routeId: params.routeId ?? '', initialView: params.initialView ?? 'list' })} options={{ title: 'ترانزيت' }} />
      <Stack.Screen name="TransitCity" component={TransitCityScreen} options={({ route }) => ({ title: route.params.city.nameAr })} />
      <Stack.Screen name="Place" component={PlaceScreen} options={{ title: 'تفاصيل المكان' }} />
      <Stack.Screen name="Feature" component={FeatureScreen} getId={({ params }) => featureRouteId(params)} options={({ route }) => ({ title: featureScreens[route.params.section]?.title ?? 'المساحة السورية', ...(route.params.section === '2048' ? { fullScreenGestureEnabled: false } : {}) })} />
    </Stack.Navigator>
    <SitePopupPublic pageKey={popupPage.key} suppressed={popupPage.suppressed} interactionVersion={interaction} />
    </View>
    </FeatureNavigationProvider>
  </NavigationContainer>;
}

export default function App(): React.JSX.Element {
  return <SafeAreaProvider><StateProvider><AccountProvider><Application /></AccountProvider></StateProvider></SafeAreaProvider>;
}
