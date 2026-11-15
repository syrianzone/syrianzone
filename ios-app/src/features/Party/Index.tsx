import { useCallback, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from '../../components';
import { NativeAction, NativePicker, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useResource } from '../../resource';
import { openExternal } from '../../platform/links';
import { formatSyrianDateTime } from '../../platform/dates';
import { decodePartyPage, filterOrganizations, formatSocialUrl, getLanguageName, type Organization } from './model';

const FORM_URL = 'https://forms.gle/vLAxoz5RNt6z6qyj9';
export function PartyScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const resource = useResource(useCallback(signal => api.page('/party', 'Party/Index', decodePartyPage, { signal }), []));
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [layout, setLayout] = useState<'grid' | 'table'>('grid');
  const [shown, setShown] = useState(15);
  const [selected, setSelected] = useState<Organization | null>(null);
  const [error, setError] = useState<string | null>(null);
  const items = useMemo(() => resource.data?.items ?? [], [resource.data]);
  const fetchedAt = resource.data?.fetchedAt ? formatSyrianDateTime(resource.data.fetchedAt) : '';
  const results = useMemo(() => filterOrganizations(items, query, filters), [items, query, filters]);
  const facets = useMemo(() => [{ key: 'category', field: 'type' }, { key: 'country', field: 'country' }, { key: 'city', field: 'city' }, { key: 'lang', field: 'lang' }].map(facet => ({ ...facet, options: [...new Set(items.map(item => item[facet.field as 'type' | 'country' | 'city' | 'lang']).filter((value): value is string => Boolean(value)))].sort() })).filter(facet => facet.options.length), [items]);
  const labels: Record<string, string> = { category: 'نوع المنظمة', country: 'البلد', city: 'المدينة', lang: 'اللغة' };
  const open = async (url: string) => { setError(null); try { await openExternal(url); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر فتح الرابط'); } };
  const organization = (item: Organization) => <Section style={{ marginBottom: 12 }}><Heading>{item.name}</Heading>{item.type ? <Label style={{ color: colors.accent }}>{item.type}</Label> : null}{item.politicalLeanings?.length ? <Label secondary>{item.politicalLeanings.join('، ')}</Label> : null}{item.description ? <Label>{item.description}</Label> : null}{item.formattedLocation ? <Label secondary>{item.formattedLocation}</Label> : null}{item.lang ? <Label secondary>{getLanguageName(item.lang)}</Label> : null}{item.mvpMembers ? <Label secondary>{item.mvpMembers}</Label> : null}<NativeAction title="الموقع والبيان وحسابات التواصل" systemImage="link" onPress={() => { setSelected(item); setError(null); }} /></Section>;
  const clear = () => { setQuery(''); setFilters({}); setShown(15); };
  return <><AdaptivePanes primary={<FlatList data={results.slice(0, shown)} keyExtractor={item => item.id} contentContainerStyle={contentStyle}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="تصفح واكتشف المنظمات والأحزاب والحركات السياسية السورية العاملة في مختلف أنحاء العالم">دليل المنظمات السياسية السورية</Heading>
      <NativeAction title="إضافة منظمة جديدة" systemImage="plus" onPress={() => void open(FORM_URL)} /><RequestStatus resource={resource} />
      <SearchField value={query} onChange={value => { setQuery(value); setShown(15); }} placeholder="ابحث بالاسم أو النوع أو المكان" />
      {facets.map(facet => <NativePicker key={facet.key} label={labels[facet.key] ?? facet.key} value={filters[facet.key] ?? ''} onChange={value => { setFilters(previous => ({ ...previous, [facet.key]: value })); setShown(15); }} options={[{ value: '', label: 'الكل' }, ...facet.options.map(value => ({ value, label: facet.key === 'lang' ? getLanguageName(value) : value }))]} />)}
      {(query || Object.values(filters).some(Boolean)) ? <NativeAction title="مسح البحث والتصفية" onPress={clear} /> : null}
      <NativeSegmented options={[{ value: 'grid', label: 'بطاقات' }, { value: 'table', label: 'قائمة' }]} value={layout} onChange={setLayout} /><Label secondary>عرض {Math.min(shown, results.length)} من أصل {results.length} منظمة</Label>
      {fetchedAt ? <Label secondary>آخر تحديث للمصدر: {fetchedAt}</Label> : null}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>}
    renderItem={({ item }) => layout === 'grid' ? organization(item) : <View style={{ marginBottom: 10 }}><Row title={item.name} subtitle={[item.type, item.formattedLocation].filter(Boolean).join('، ')} onPress={() => { setSelected(item); setError(null); }} /></View>}
    ListEmptyComponent={!resource.loading ? <EmptyState title="لم يتم العثور على منظمات" detail="جرّب تغيير مصطلحات البحث أو الفلاتر" /> : <View />}
    ListFooterComponent={<View style={{ gap: 14 }}>{shown < results.length ? <NativeAction title="عرض المزيد" onPress={() => setShown(value => value + 15)} /> : null}<NativeAction title="إضافة منظمة إلى الدليل" systemImage="plus" onPress={() => void open(FORM_URL)} /></View>} />} />
    <Modal visible={selected !== null} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setSelected(null)}><AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><NativeAction title="إغلاق التفاصيل" systemImage="xmark" onPress={() => setSelected(null)} />{selected ? <><Heading>{selected.name}</Heading>{selected.description ? <Label>{selected.description}</Label> : null}{selected.website ? <NativeAction title="الموقع الإلكتروني" systemImage="globe" onPress={() => void open(selected.website!)} /> : null}{selected.manifesto ? <NativeAction title="البيان التأسيسي" systemImage="doc.text" onPress={() => void open(selected.manifesto!)} /> : null}
      {([{ field: 'socialFb', platform: 'facebook', label: 'Facebook' }, { field: 'socialX', platform: 'x', label: 'X' }, { field: 'socialInsta', platform: 'instagram', label: 'Instagram' }, { field: 'youtube', platform: 'youtube', label: 'YouTube' }, { field: 'telegram', platform: 'telegram', label: 'Telegram' }] as const).map(link => selected[link.field] ? <NativeAction key={link.field} title={link.label} onPress={() => void open(formatSocialUrl(link.platform, selected[link.field]!))} /> : null)}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</> : null}</ScrollView>} /></Modal></>;
}
// PORT STATUS: source resources/js/Pages/Party/PartyClient.tsx; confidence medium; todos 0.
