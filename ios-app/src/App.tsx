import { useCallback } from 'react';
import { ScrollView, View, useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { NavigationContainer, DarkTheme, DefaultTheme, type NavigationProp, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { api } from './api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, Section } from './components';
import { MapView } from './MapView';
import { useResource } from './resource';
import { useAppState, StateProvider, useNativeAppearance } from './state';
import { NativeAction, NativeSegmented, NativeSymbol } from './ui/native';
import { ThemeProvider, themeColors, useTheme } from './ui/theme';
import { TransitCityScreen, TransitScreen } from './transit';
import { PlaceScreen, PlacesScreen, SavedScreen } from './places';
import { PromiseScreen, PromisesScreen } from './promises';
import type { RootNavigation, RootRoutes, TabRoutes } from './navigation';
import logo from '../../public/icons/icon-180.png';

const Stack = createNativeStackNavigator<RootRoutes>();
const Tabs = createNativeBottomTabNavigator<TabRoutes>();

function HomeScreen(): React.JSX.Element {
  const navigation = useNavigation<NavigationProp<TabRoutes> & RootNavigation>();
  const { colors } = useTheme();
  const cities = useResource(useCallback(signal => api.cities(signal), []));
  const places = useResource(useCallback(signal => api.places({ sort: 'popular' }, signal), []));
  const { saved } = useAppState();
  const pins = places.data?.items.map(place => ({ id: String(place.id), name: place.name, coordinate: place.coordinate })) ?? [];
  const feed = <ScrollView contentContainerStyle={contentStyle}>
    <Section style={{ backgroundColor: colors.accentMuted, gap: 18, padding: 24 }}>
      <Image source={logo} style={{ width: 58, height: 58, borderRadius: 15 }} accessibilityLabel="شعار المساحة السورية" />
      <Heading subtitle="أماكن تستحق الزيارة، وطرق تقرّب المسافة.">سوريا، أقرب إليك</Heading>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View><Label style={{ fontSize: 24, fontWeight: '700' }}>{cities.data?.filter(city => !city.comingSoon).length ?? '…'}</Label><Label secondary>مدن للنقل</Label></View>
        <View><Label style={{ fontSize: 24, fontWeight: '700' }}>{places.data?.total ?? '…'}</Label><Label secondary>مكان للاستكشاف</Label></View>
      </View>
    </Section>
    <Section><NativeSymbol name="bus.fill" size={32} /><Heading subtitle="ابحث عن خطك ومحطتك، وتابع المسار على الخريطة.">ترانزيت</Heading>
      <NativeAction title="استكشف خطوط النقل" systemImage="arrow.up.forward" prominent onPress={() => navigation.navigate('Transit')} />
    </Section>
    <Section><NativeSymbol name="map.fill" size={32} /><Heading subtitle="زوايا سورية من اقتراحات المجتمع.">مشوار</Heading>
      <NativeAction title="اكتشف الأماكن" systemImage="arrow.up.forward" onPress={() => navigation.navigate('Places')} />
    </Section>
    <Section><NativeSymbol name="checklist" size={32} /><Heading subtitle="تابع مواعيد الوعود الحكومية وما تحقق منها.">عداد الوعود</Heading>
      <NativeAction title="تصفّح الوعود الحكومية" systemImage="arrow.up.forward" onPress={() => navigation.navigate('Promises')} />
    </Section>
    <Row title="المحفوظات" subtitle={`${saved.length} مكان محفوظ على هذا الجهاز`} symbol="bookmark.fill" onPress={() => navigation.navigate('Saved')} />
    <RequestStatus resource={cities} /><RequestStatus resource={places} />
  </ScrollView>;
  const map = <View style={{ flex: 1, padding: 18, gap: 14 }}><Heading subtitle="من الأماكن الأكثر حفظاً">على الخريطة</Heading><MapView pins={pins}
    onPinPress={id => { const place = places.data?.items.find(item => String(item.id) === id); if (place) navigation.navigate('Place', { id: place.id, snapshot: place }); }} />
    <Label secondary>تظهر نتائج الصفحة الأولى من مشوار.</Label>
  </View>;
  return <AdaptivePanes primary={feed} secondary={map} />;
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
    <Tabs.Screen name="Transit" component={TransitScreen} options={{ title: 'ترانزيت', tabBarIcon: { type: 'sfSymbol', name: 'bus' } }} />
    <Tabs.Screen name="Places" component={PlacesScreen} options={{ title: 'مشوار', tabBarIcon: { type: 'sfSymbol', name: 'map' } }} />
    <Tabs.Screen name="Saved" component={SavedScreen} options={{ title: 'المحفوظات', tabBarIcon: { type: 'sfSymbol', name: 'bookmark' } }} />
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
  const base = mode === 'dark' ? DarkTheme : DefaultTheme;
  return <NavigationContainer<RootRoutes> linking={{ prefixes: ['syrianzone://'], config: { screens: {
    Main: { path: '', screens: { Home: '', Transit: 'transit', Places: 'places', Saved: 'saved', Settings: 'settings' } },
    Place: { path: 'place/:id', parse: { id: value => /^\d{1,10}$/.test(value) ? Number(value) : 0 } },
    Promises: 'promises',
    Promise: { path: 'promises/:number', parse: { number: value => /^\d{1,9}$/.test(value) ? Number(value) : 0 } },
  } } }} theme={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.accent, border: colors.separator } }}>
    <Stack.Navigator screenOptions={{ headerTintColor: colors.accent, headerBackTitle: 'رجوع', statusBarStyle: mode === 'dark' ? 'light' : 'dark', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false, title: 'المساحة السورية' }} />
      <Stack.Screen name="TransitCity" component={TransitCityScreen} options={({ route }) => ({ title: route.params.city.nameAr })} />
      <Stack.Screen name="Place" component={PlaceScreen} options={{ title: 'تفاصيل المكان' }} />
      <Stack.Screen name="Promises" component={PromisesScreen} options={{ title: 'الوعود الحكومية' }} />
      <Stack.Screen name="Promise" component={PromiseScreen} options={{ title: 'تفاصيل الوعد' }} />
    </Stack.Navigator>
  </NavigationContainer>;
}

export default function App(): React.JSX.Element {
  return <SafeAreaProvider><StateProvider><Application /></StateProvider></SafeAreaProvider>;
}
