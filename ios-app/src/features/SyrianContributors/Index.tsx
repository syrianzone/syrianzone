import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { api } from '../../api';
import { Heading, Label, Section, contentStyle } from '../../components';
import { NativeAction, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { artwork } from '../../ui/original-artwork.generated';
import { openExternal } from '../../platform/links';
import { record } from '../../platform/validation';
import { decodeContributors, rankContributors, type Contributor, type Metric } from './model';
const METRICS: { value: Metric; label: string }[] = [{ value: 'daily_contributions', label: 'يومي' }, { value: 'monthly_contributions', label: 'شهري' }, { value: 'yearly_contributions', label: 'سنوي' }, { value: 'total_contributions', label: 'إجمالي' }];
function Avatar({ contributor }: { contributor: Contributor }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return contributor.avatar && !failed ? <Image source={{ uri: contributor.avatar }} accessibilityLabel={contributor.username} onError={() => setFailed(true)} cachePolicy="memory-disk" style={{ width: 64, height: 64, borderRadius: 32 }} /> : <Label style={{ fontSize: 24 }}>{contributor.username.slice(0, 2).toUpperCase()}</Label>;
}
export function ContributorsScreen(): React.JSX.Element {
  const [entries, setEntries] = useState<Contributor[]>([]);
  const [metric, setMetric] = useState<Metric>('total_contributions');
  const [eagle, setEagle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const { colors } = useTheme();
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => {
    if (!active || !focused) return;
    const controller = new AbortController();
    const load = (): void => { void api.page('/syrian-contributors', 'SyrianContributors/Index', value => decodeContributors(record(value).contributors), { signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setEntries(value); setError(null); } }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحديث المساهمين.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); };
    load(); const timer = setInterval(load, 60 * 60 * 1000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [revision, active, focused]);
  const ranked = useMemo(() => rankContributors(entries, metric), [entries, metric]);
  const open = (username: string): void => { void openExternal(`https://github.com/${encodeURIComponent(username)}`).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح الملف الشخصي.')); };
  return <View style={{ flex: 1, backgroundColor: colors.background }}><View pointerEvents="none" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}><SvgXml xml={artwork.pattern!} width="100%" height="100%" /></View>
    <FlatList style={{ flex: 1 }} data={ranked} keyExtractor={item => item.username} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}><Pressable accessibilityRole="button" accessibilityLabel={eagle ? 'عرض علم سوريا' : 'عرض النسر السوري'} onPress={() => setEagle(value => !value)} style={{ alignItems: 'center' }}><SvgXml xml={artwork[eagle ? 'logo' : 'flag']!} width={180} height={120} /></Pressable><Heading subtitle="تكريم المطورين السوريين المساهمين في المصادر المفتوحة">أفضل المساهمين في GitHub</Heading><NativeAction title="صنع بواسطة @z44d" systemImage="link" onPress={() => open('z44d')} /><NativeSegmented options={METRICS} value={metric} onChange={setMetric} />{loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="جارٍ تحميل المساهمين" /> : null}{error ? <Section><Label style={{ color: colors.danger }}>{error}</Label><NativeAction title="إعادة المحاولة" onPress={() => setRevision(value => value + 1)} /></Section> : null}</View>}
      ListEmptyComponent={!loading && !error ? <Section><Label>لا توجد بيانات لعرضها حالياً.</Label><NativeAction title="إعادة المحاولة" onPress={() => setRevision(value => value + 1)} /></Section> : undefined}
      renderItem={({ item, index }) => <Section style={index < 3 ? { borderWidth: 1, borderColor: colors.accent } : {}}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Label style={{ fontSize: index < 3 ? 30 : 20 }}>#{index + 1}</Label><Avatar contributor={item} /><View style={{ flex: 1 }}><Label style={{ fontWeight: '700' }}>{item.username}</Label><Label secondary>{item[metric]} مساهمة</Label></View></View><NativeAction title="الملف الشخصي على GitHub" systemImage="arrow.up.right.square" onPress={() => open(item.username)} /></Section>} />
  </View>;
}
// PORT STATUS: source resources/js/Pages/SyrianContributors/Index.tsx; confidence medium; todos 1 native artwork/avatar rendering verification.
