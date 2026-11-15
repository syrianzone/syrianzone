import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import media from '../../../../resources/data/media.json';
import { api } from '../../api';
import { Heading, Label, RequestStatus, SearchField, Section, contentStyle } from '../../components';
import { useResource } from '../../resource';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { openExternal } from '../../platform/links';
import type { FeatureScreenProps } from '../../platform/features';
import { decodeGovApps, filterGovApps, type GovApp, type Platform } from './model';
const PLATFORMS: { value: Platform; label: string }[] = [{ value: 'apple', label: 'آيفون' }, { value: 'android', label: 'أندرويد' }, { value: 'official', label: 'الموقع الرسمي' }];
function AppCard({ app, open }: { app: GovApp; open(url: string): void }): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const fallback = `${media.public_base}/govapps/mofa/icon.webp`;
  return <Section><Image source={{ uri: failed ? fallback : app.icon ?? fallback }} onError={() => setFailed(true)} accessibilityLabel={app.name} style={{ width: '100%', height: 140, borderRadius: 14 }} contentFit="contain" cachePolicy="memory-disk" />
    <Label style={{ fontWeight: '700' }}>{app.name}</Label>{app.description ? <><Label>{expanded || app.description.length <= 120 ? app.description : `${app.description.slice(0, 120)}…`}</Label>{app.description.length > 120 ? <NativeAction title={expanded ? 'إخفاء التفاصيل' : 'إظهار الوصف كاملاً'} onPress={() => setExpanded(value => !value)} /> : null}</> : null}
    {PLATFORMS.filter(p => app.links[p.value]).map(p => <NativeAction key={p.value} title={p.label} systemImage={p.value === 'official' ? 'globe' : 'arrow.up.right.square'} onPress={() => open(app.links[p.value] ?? '')} />)}
    {app.legacyLinks.map((url, index) => <NativeAction key={`${index}:${url}`} title={`رابط إضافي ${index + 1}`} systemImage="link" onPress={() => open(url)} />)}
  </Section>;
}
export function GovAppsScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const [query, setQuery] = useState(params.q ?? '');
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => api.page('/govapps', 'GovApps/Index', decodeGovApps, { signal }), []);
  const resource = useResource(load);
  const results = useMemo(() => filterGovApps(resource.data ?? [], query, platforms), [resource.data, query, platforms]);
  const open = (url: string): void => { setError(null); void openExternal(url).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح الرابط.')); };
  return <FlatList data={results} keyExtractor={item => item.id} style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}><ProjectIcon name="govapps" size={46} /><Heading subtitle="دليل التطبيقات والخدمات الحكومية الإلكترونية الرسمية">تطبيقات حكومية</Heading>
      <SearchField value={query} onChange={setQuery} placeholder="ابحث بالاسم أو الوصف" /><ScrollView horizontal contentContainerStyle={{ gap: 8 }}>{PLATFORMS.map(p => <Pressable key={p.value} accessibilityRole="checkbox" accessibilityState={{ checked: platforms.includes(p.value) }} onPress={() => setPlatforms(current => current.includes(p.value) ? current.filter(v => v !== p.value) : [...current, p.value])} style={{ padding: 12, borderRadius: 12, backgroundColor: platforms.includes(p.value) ? colors.accentMuted : colors.surface }}><Label>{p.label}</Label></Pressable>)}</ScrollView>
      <RequestStatus resource={resource} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}<Label secondary>{results.length} تطبيق</Label>
    </View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <Section><Label>لا توجد تطبيقات تطابق البحث والتصفية.</Label><NativeAction title="مسح البحث والتصفية" onPress={() => { setQuery(''); setPlatforms([]); }} /></Section> : undefined}
    renderItem={({ item }) => <AppCard app={item} open={open} />} />;
}
// PORT STATUS: source resources/js/Pages/GovApps/GovAppsClient.tsx; confidence medium; todos 1 native light/dark interaction and external link verification.
