// Test-only Contributors layout. Only the opt-in data phase reads the public source page. No personal/settings writes or external-link actions. The source Avatar may populate the SDK image cache.
import { Button as SwiftButton, Picker, Text as SwiftText } from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, controlSize, disabled, frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { DarkTheme, NavigationContainer, useIsFocused } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Button, FlatList, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { Image } from 'expo-image';
import { Directory, File, Paths } from 'expo-file-system';
import { CONTRIBUTORS_TRACE_FILENAME, createContributorsTraceWriter } from './contributors-layout-trace';
import { Heading, Label, Section, contentStyle } from '../src/components';
import { api } from '../src/api';
import { record } from '../src/platform/validation';
import { NativeAction, NativeThemeHost } from '../src/ui/native';
import { artwork } from '../src/ui/original-artwork.generated';
import { ThemeProvider, themeColors, useTheme } from '../src/ui/theme';
import { decodeContributors, rankContributors, type Contributor, type Metric } from '../src/features/SyrianContributors/model';

type Kind = 'outer' | 'list' | 'header' | 'author' | 'metric' | 'cell0' | 'cell1' | 'cell2';
type Pair = [number, number];
type Samples = Record<Kind, { count: number; pairs: Pair[] }>;
const CAP = 24;
const DATA_PHASE = process.env.EXPO_PUBLIC_NATIVE_CONTRIBUTORS_LAYOUT === '2';
const METRICS: { value: Metric; label: string }[] = [{ value: 'daily_contributions', label: 'يومي' }, { value: 'monthly_contributions', label: 'شهري' }, { value: 'yearly_contributions', label: 'سنوي' }, { value: 'total_contributions', label: 'إجمالي' }];
const Stack = createNativeStackNavigator<{ Home: undefined; Contributors: undefined }>();

function saveNumericTrace(raw: string): void {
  try {
    const target = new File(Paths.cache, CONTRIBUTORS_TRACE_FILENAME);
    const stage = new Directory(Paths.cache, `${CONTRIBUTORS_TRACE_FILENAME}.staging`);
    const staged = new File(stage, 'trace.json');
    createContributorsTraceWriter({
      finalExists: () => target.exists,
      createOwnedStage: () => stage.create({ overwrite: false, idempotent: false, intermediates: false }),
      writeOwnedStage: bytes => { staged.writeSync(bytes); if (staged.size !== bytes.length) throw new Error('Trace write did not complete.'); },
      copyToFinalWithoutOverwrite: () => staged.copySync(target, { overwrite: false }),
      removePositivelyCreatedStage: () => {
        // The writer calls this only after this invocation created the directory.
        const entries = stage.list();
        if (entries.some(entry => entry.uri !== staged.uri || !(entry instanceof File))) return;
        if (staged.exists) staged.delete();
        if (stage.list().length === 0) stage.delete();
      }
    })(raw);
  } catch {
    // No paths, payloads or native exception text enter diagnostics. Absence is inconclusive.
  }
}

function initialSamples(): Samples {
  return { outer: { count: 0, pairs: [] }, list: { count: 0, pairs: [] }, header: { count: 0, pairs: [] }, author: { count: 0, pairs: [] }, metric: { count: 0, pairs: [] }, cell0: { count: 0, pairs: [] }, cell1: { count: 0, pairs: [] }, cell2: { count: 0, pairs: [] } };
}
function EmptyHome(): null { return null; }

function Avatar({ contributor }: { contributor: Contributor }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return contributor.avatar && !failed ? <Image source={{ uri: contributor.avatar }} accessibilityLabel={contributor.username} onError={() => setFailed(true)} cachePolicy="memory-disk" style={{ width: 64, height: 64, borderRadius: 32 }} /> : <Label style={{ fontSize: 24 }}>{contributor.username.slice(0, 2).toUpperCase()}</Label>;
}
function forbidLink(): never { throw new Error('The layout-only fixture forbids external-link activation.'); }
function InitialContributorsLayout(): React.JSX.Element {
  const { colors } = useTheme();
  const [entries, setEntries] = useState<Contributor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => {
    if (!DATA_PHASE || !active || !focused) return;
    const controller = new AbortController();
    const load = (): void => { void api.page('/syrian-contributors', 'SyrianContributors/Index', value => decodeContributors(record(value).contributors), { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setEntries(value); setError(null); } }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحديث المساهمين.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); };
    load(); const timer = setInterval(load, 60 * 60 * 1000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [revision, active, focused]);
  const [metric, setMetric] = useState<Metric>('total_contributions');
  const [eagle, setEagle] = useState(false);
  const [snapshot, setSnapshot] = useState('not-captured');
  const ranked = useMemo(() => rankContributors(entries, metric), [entries, metric]);
  const samples = useRef(initialSamples());
  const dataState = useRef({ loaded: false, count: 0, loading: true, error: false });
  dataState.current = { loaded: DATA_PHASE && !loading && !error, count: entries.length, loading, error: error !== null };
  const emitted = useRef(false);
  const emit = useCallback((reason: 'cap' | 'timer' | 'manual'): string => {
    const value = JSON.stringify({ fixture: DATA_PHASE ? 'loaded-contributors-layout' : 'initial-contributors-layout', reason, cap: CAP, initialDataCount: 0, loading: dataState.current.loading, dataState: dataState.current,
      samples: samples.current,
      limits: DATA_PHASE ? 'Fixture-only public source page, real cells and first-three numeric cell Host observations. No full App context, external actions or product cause conclusion.' : 'Fixture-only initial header; no cells, API, parent App providers or production cause conclusion. Public layout callbacks only.' });
    if (reason !== 'manual' && !emitted.current) {
      emitted.current = true;
      if (DATA_PHASE) saveNumericTrace(value);
      console.info(`SZ_CONTRIBUTORS_LAYOUT ${value}`);
    }
    return value;
  }, []);
  const observe = useCallback((kind: Kind, width: number, height: number): void => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return;
    const current = samples.current[kind];
    if (current.count >= CAP) return;
    current.count += 1;
    current.pairs.push([width, height]);
    if (current.count === CAP) emit('cap');
  }, [emit]);
  const layout = (kind: 'outer' | 'list' | 'header') => (event: LayoutChangeEvent): void => {
    observe(kind, event.nativeEvent.layout.width, event.nativeEvent.layout.height);
  };
  useEffect(() => {
    if (DATA_PHASE && loading) return;
    const timer = setTimeout(() => { emit('timer'); }, 3000);
    return () => clearTimeout(timer);
  }, [emit, loading]);
  useEffect(() => {
    if (!DATA_PHASE) return;
    const deadline = setTimeout(() => { emit('timer'); }, 20000);
    return () => clearTimeout(deadline);
  }, [emit]);
  return <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={layout('outer')}>
    <View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}><SvgXml xml={artwork.pattern!} width="100%" height="100%" /></View>
    <FlatList style={{ flex: 1 }} data={ranked} keyExtractor={item => item.username} contentContainerStyle={contentStyle} onLayout={layout('list')}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }} onLayout={layout('header')}>
        <Pressable accessibilityRole="button" accessibilityLabel={eagle ? 'عرض علم سوريا' : 'عرض النسر السوري'} onPress={() => setEagle(value => !value)} style={{ alignItems: 'center' }}><SvgXml xml={artwork[eagle ? 'logo' : 'flag']!} width={180} height={120} /></Pressable>
        <Heading subtitle="تكريم المطورين السوريين المساهمين في المصادر المفتوحة">أفضل المساهمين في GitHub</Heading>
        <NativeThemeHost matchContents={{ vertical: true }} style={[{ alignSelf: 'stretch' }, undefined]}
          onLayoutContent={event => observe('author', event.nativeEvent.width, event.nativeEvent.height)}>
          <SwiftButton label="صنع بواسطة @z44d" systemImage="link" role="default"
            onPress={() => { throw new Error('The layout-only fixture forbids author-link activation.'); }}
            modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(false), accessibilityLabel('صنع بواسطة @z44d'), frame({ maxWidth: Infinity, minHeight: 44 })]} />
        </NativeThemeHost>
        <NativeThemeHost matchContents={{ vertical: true }}
          onLayoutContent={event => observe('metric', event.nativeEvent.width, event.nativeEvent.height)}>
          <Picker label="اختيار العرض" selection={metric} onSelectionChange={setMetric} modifiers={[pickerStyle('segmented'), disabled(false)]}>
            {METRICS.map(option => <SwiftText key={option.value} modifiers={[tag(option.value)]}>{option.label}</SwiftText>)}
          </Picker>
        </NativeThemeHost>
        {loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="جارٍ تحميل المساهمين" /> : null}
        {error ? <Section><Label style={{ color: colors.danger }}>{error}</Label><NativeAction title="إعادة المحاولة" onPress={() => setRevision(value => value + 1)} /></Section> : null}
      </View>}
      ListEmptyComponent={!loading && !error ? <Section><Label>لا توجد بيانات لعرضها حالياً.</Label><NativeAction title="إعادة المحاولة" onPress={() => setRevision(value => value + 1)} /></Section> : undefined}
      renderItem={({ item, index }) => <Section style={index < 3 ? { borderWidth: 1, borderColor: colors.accent } : {}}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Label style={{ fontSize: index < 3 ? 30 : 20 }}>#{index + 1}</Label><Avatar contributor={item} /><View style={{ flex: 1 }}><Label style={{ fontWeight: '700' }}>{item.username}</Label><Label secondary>{item[metric]} مساهمة</Label></View></View>
        {index < 3 ? <NativeThemeHost matchContents={{ vertical: true }} style={[{ alignSelf: 'stretch' }, undefined]}
          onLayoutContent={event => observe(`cell${index}` as 'cell0' | 'cell1' | 'cell2', event.nativeEvent.width, event.nativeEvent.height)}>
          <SwiftButton label="الملف الشخصي على GitHub" systemImage="arrow.up.right.square" role="default" onPress={forbidLink}
            modifiers={[buttonStyle('bordered'), controlSize('large'), disabled(false), accessibilityLabel('الملف الشخصي على GitHub'), frame({ maxWidth: Infinity, minHeight: 44 })]} />
        </NativeThemeHost> : <NativeAction title="الملف الشخصي على GitHub" systemImage="arrow.up.right.square" onPress={forbidLink} />}
      </Section>} />
    <View testID="adapter.contributors-layout" collapsable={false} style={{ position: 'absolute', width: 1, height: 1, top: 0, start: 0 }} />
    <Text testID="adapter.contributors-layout.snapshot" accessibilityValue={{ text: snapshot }}
      style={{ position: 'absolute', bottom: 4, start: 8, fontSize: 10, color: colors.secondary }}>LAYOUT SNAPSHOT</Text>
    <View style={{ position: 'absolute', bottom: 20, end: 20 }}><Button testID="adapter.contributors-layout.capture" title="Capture layout pairs" onPress={() => setSnapshot(emit('manual'))} /></View>
  </View>;
}

export function ContributorsLayoutFixture(): React.JSX.Element {
  const colors = themeColors.dark;
  return <SafeAreaProvider><ThemeProvider mode="dark"><NavigationContainer theme={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.surface, text: colors.text, primary: colors.accent, border: colors.separator } }}
    initialState={{ index: 1, routes: [{ name: 'Home' }, { name: 'Contributors' }] }}>
    <Stack.Navigator screenOptions={{ headerTintColor: colors.accent, headerBackTitle: 'رجوع', statusBarStyle: 'light', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Home" component={EmptyHome} options={{ title: 'المساحة السورية' }} />
      <Stack.Screen name="Contributors" component={InitialContributorsLayout} options={{ title: 'المساهمون السوريون' }} />
    </Stack.Navigator>
  </NavigationContainer></ThemeProvider></SafeAreaProvider>;
}
