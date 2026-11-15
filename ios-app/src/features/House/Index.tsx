import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, SearchField, Section } from '../../components';
import { matchesSearch } from '../../domain';
import { useResource } from '../../resource';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { openExternal } from '../../platform/links';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { AGE_LABEL, decodeHousePage, groupKey, groupLabel, mergeRoster, OMran_SOURCE_URL, SOCIAL_LABEL, STATUS_LABEL, type Dimension } from './model';
import { ParliamentChart2026 } from './ParliamentChart2026';
import { HouseClient } from './HouseClient';

export function HouseScreen({ params }: FeatureScreenProps): React.JSX.Element { return params.view === 'archive' ? <HouseClient /> : <CurrentHouse />; }
function CurrentHouse(): React.JSX.Element {
  const { colors } = useTheme(); const navigation = useFeatureNavigation();
  const resource = useResource(useCallback(signal => api.page('/house', 'House/Index', decodeHousePage, { signal }), []));
  const members = useMemo(() => mergeRoster(resource.data ?? []), [resource.data]);
  const [dimension, setDimension] = useState<Dimension>('selection');
  const [filters, setFilters] = useState<Partial<Record<Dimension, string>>>({});
  const [query, setQuery] = useState(''); const [status, setStatus] = useState('active'); const [error, setError] = useState<string | null>(null);
  const active = useMemo(() => members.filter(member => (member.status || 'active') === 'active'), [members]);
  const results = useMemo(() => members.filter(member => matchesSearch(member.name_ar, query) && (member.status || 'active') === status && Object.entries(filters).every(([key, value]) => !value || groupKey(member, key as Dimension) === value)), [members, query, status, filters]);
  const statusCounts = useMemo(() => members.reduce<Record<string, number>>((counts, member) => { const key = member.status || 'active'; counts[key] = (counts[key] ?? 0) + 1; return counts; }, {}), [members]);
  const choose = (key: Dimension, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const open = async (url: string) => { setError(null); try { await openExternal(url); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر فتح الرابط'); } };
  return <AdaptivePanes primary={<FlatList data={results} keyExtractor={(member, index) => `${member.member_number}:${member.name_ar}:${index}`} contentContainerStyle={contentStyle}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="أعضاء مجلس الشعب السوري2026">مجلس الشعب</Heading><RequestStatus resource={resource} />
      {!resource.data?.length ? <Label secondary>تُعرض النسخة المرفقة من سجل2026 حتى تتوفر بيانات المصدر.</Label> : null}
      <Section><Label>إجمالي الأعضاء: {members.length}</Label><Label>ذكور نشطون: {active.filter(member => member.gender !== 'F').length}، إناث نشطات: {active.filter(member => member.gender === 'F').length}</Label></Section>
      <ParliamentChart2026 members={members} dimension={dimension} selected={filters[dimension] ?? ''} onDimension={setDimension} onSelect={value => choose(dimension, filters[dimension] === value ? '' : value)} />
      <Heading>قائمة الأعضاء ({results.length})</Heading><SearchField value={query} onChange={setQuery} placeholder="ابحث عن عضو بالاسم" />
      <NativePicker label="حالة العضوية" value={status} onChange={setStatus} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label: `${label} (${statusCounts[value] ?? 0})` }))} />
      {(['governorate', 'gender', 'selection', 'age', 'social'] as const).map(key => {
        const values = key === 'age' ? Object.keys(AGE_LABEL) : key === 'social' ? Object.keys(SOCIAL_LABEL) : [...new Set(members.map(member => groupKey(member, key)))].sort();
        const label = ({ governorate: 'المحافظة', gender: 'الجنس', selection: 'طريقة التعيين', age: 'الفئة العمرية', social: 'التواصل الاجتماعي' })[key];
        return <NativePicker key={key} label={label} value={filters[key] ?? ''} onChange={value => choose(key, value)} options={[{ value: '', label: 'الكل' }, ...values.map(value => ({ value, label: groupLabel(value, key) }))]} />;
      })}<NativeAction title="مسح البحث والتصفية" onPress={() => { setQuery(''); setFilters({}); }} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>}
    renderItem={({ item: member }) => <Section style={{ marginVertical: 8 }}><Heading>{member.name_ar}</Heading>{member.management_position ? <Label style={{ color: colors.accent }}>{member.management_position}</Label> : null}<Label secondary>{member.governorate_ar}، {member.district} {member.town}</Label><Label>{member.gender === 'F' ? 'أنثى' : 'ذكر'}، العمر {member.age || 'غير محدد'}، {member.selection_method || 'طريقة تعيين غير محددة'}</Label>{member.category ? <Label secondary>{member.category}</Label> : null}{member.facebook_url ? <NativeAction title={`Facebook: ${member.name_ar}`} onPress={() => void open(member.facebook_url!)} /> : null}{member.twitter_url ? <NativeAction title={`X: ${member.name_ar}`} onPress={() => void open(member.twitter_url!)} /> : null}</Section>}
    ListEmptyComponent={<EmptyState title="لا توجد نتائج" detail="غيّر البحث أو التصفية" />}
    ListFooterComponent={<Section><NativeAction title="البيانات التاريخية والهيئات الناخبة" systemImage="archivebox" onPress={() => navigation.open('house', { view: 'archive' })} /><Label secondary>المصدر: مركز عمران للدراسات الاستراتيجية</Label><NativeAction title="المصدر الأصلي" systemImage="arrow.up.right.square" onPress={() => void open(OMran_SOURCE_URL)} /><NativeAction title="موقع معدّ البيانات" onPress={() => void open('https://hadealahmad.com')} /><NativeAction title="حساب معدّ البيانات علىX" onPress={() => void open('https://x.com/hadealahmad')} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</Section>} />} />;
}
// PORT STATUS: source resources/js/Pages/House/Index.tsx and MemberTable2026.tsx; confidence medium; todos 0.
