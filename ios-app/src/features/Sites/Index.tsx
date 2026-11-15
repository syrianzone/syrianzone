import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { api } from '../../api';
import { Heading, Label, RequestStatus, SearchField, Section, contentStyle } from '../../components';
import { useResource } from '../../resource';
import { NativeAction, NativeSegmented, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { openExternal } from '../../platform/links';
import { decodeSitesPage, filterSites, typeLabel } from './model';

const SUBMISSION = 'https://docs.google.com/forms/d/e/1FAIpQLSdIu8TFwSmT7fHxzsVlOwt35X9Myfhg0RZ6jwEkIMxxvyctqA/viewform';
function Favicon({ url }: { url: string }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return failed ? <NativeSymbol name="globe" size={36} /> : <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(url).hostname)}&sz=64` }} onError={() => setFailed(true)} style={{ width: 36, height: 36 }} contentFit="contain" cachePolicy="memory-disk" />;
}
export function SitesScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const [limit, setLimit] = useState(24);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback((signal: AbortSignal) => api.page('/sites', 'Sites/Index', decodeSitesPage, { signal }), []);
  const resource = useResource(load);
  const results = useMemo(() => filterSites(resource.data?.items ?? [], query, type), [resource.data, query, type]);
  const types = [...new Set(resource.data?.items.map(item => item.type).filter(Boolean) ?? [])].sort();
  const open = (url: string): void => { setError(null); void openExternal(url).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر فتح الموقع.')); };
  return <FlatList key={view} data={results.slice(0, limit)} numColumns={view === 'grid' ? 2 : 1} keyExtractor={item => item.id}
    style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle} columnWrapperStyle={view === 'grid' ? { gap: 12 } : undefined}
    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}>
      <ProjectIcon name="sites" size={46} /><Heading subtitle="قاعدة بيانات المواقع السورية مصنفة حسب القطاعات">المواقع السورية</Heading>
      <NativeAction title="إضافة موقع جديد" systemImage="plus" onPress={() => open(SUBMISSION)} />
      <SearchField value={query} onChange={value => { setQuery(value); setLimit(24); }} placeholder="ابحث في المواقع السورية" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{['', ...types].map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: value === type }} onPress={() => { setType(current => current === value ? '' : value); setLimit(24); }} style={{ padding: 12, borderRadius: 12, backgroundColor: value === type ? colors.accentMuted : colors.surface }}><Label>{value ? typeLabel(value) : 'الكل'}</Label></Pressable>)}</ScrollView>
      <NativeSegmented options={[{ value: 'grid', label: 'بطاقات' }, { value: 'table', label: 'قائمة' }]} value={view} onChange={setView} />
      <RequestStatus resource={resource} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
      <Label secondary>عرض {Math.min(limit, results.length)} من {results.length} موقع</Label>
    </View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <Section><Label>لم يتم العثور على مواقع.</Label><NativeAction title="مسح البحث والتصفية" onPress={() => { setQuery(''); setType(''); }} /></Section> : undefined}
    ListFooterComponent={results.length > limit ? <NativeAction title="تحميل المزيد" onPress={() => setLimit(value => value + 24)} /> : undefined}
    renderItem={({ item }) => <Pressable accessibilityRole="link" accessibilityLabel={`${item.name}، ${item.description}`} onPress={() => open(item.url)} style={{ flex: 1 }}><Section style={{ flex: 1 }}>
      <Favicon url={item.url} /><Label style={{ fontWeight: '700' }}>{item.name}</Label><Label secondary>{typeLabel(item.type)}</Label>{item.description ? <Label>{item.description}</Label> : null}<Label secondary>{new URL(item.url).hostname}</Label>
    </Section></Pressable>} />;
}
// PORT STATUS: source resources/js/Pages/Sites/SitesClient.tsx; confidence high; todos 0.
