import { useCallback, useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Image } from 'expo-image';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Section } from '../../components';
import { NativeAction, NativePicker, NativeSegmented } from '../../ui/native';
import { useResource } from '../../resource';
import { useTheme } from '../../ui/theme';
import { shareText } from '../../platform/links';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { CORE_POLL_SLUG, decodeLeaderboard } from './model';
import { TimeseriesChart } from './TimeseriesChart';

export function TierLeaderboard({ params }: FeatureScreenProps): React.JSX.Element {
  const { colors } = useTheme(); const navigation = useFeatureNavigation(); const slug = params.poll || CORE_POLL_SLUG;
  const [status, setStatus] = useState<'active' | 'former' | 'all'>(params.status === 'former' || params.status === 'archived' ? 'former' : params.status === 'all' ? 'all' : 'active'); const [groupId, setGroupId] = useState(''); const [error, setError] = useState<string | null>(null);
  const resource = useResource(useCallback(signal => { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(slug)) return Promise.reject(new Error('رابط الاستطلاع غير صالح')); return api.request(`polls/${slug}/leaderboard`, decodeLeaderboard, { params: { status }, signal }); }, [slug, status]));
  const data = resource.data; const group = data?.groups.find(item => item.id === groupId) ?? data?.groups.find(item => item.isDefault) ?? data?.groups[0];
  const rows = useMemo(() => group && data ? data.rankings[group.rankingKey] ?? [] : [], [group, data]);
  const successorNames = useMemo(() => new Map(Object.values(data?.rankings ?? {}).flatMap(values => values.map(row => [row.candidateId, row.name] as const))), [data]);
  const podium = rows.length >= 3 ? [rows[1]!, rows[0]!, rows[2]!] : [];
  return <AdaptivePanes primary={<FlatList data={rows} keyExtractor={row => row.candidateId} contentContainerStyle={contentStyle} initialNumToRender={12} windowSize={7}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="نتائج تقييمات الجمهور، وليست تقييماً رسمياً">{slug === CORE_POLL_SLUG ? 'الإحصائيات' : data?.poll.title ?? 'قائمة الترتيب'}</Heading><NativeAction title="اذهب للتقييم" onPress={() => navigation.open('tierlist', { poll: slug })} /><RequestStatus resource={resource} />
      <NativeSegmented options={[{ value: 'active', label: 'الحاليون' }, { value: 'former', label: 'السابقون' }, { value: 'all', label: 'الكل' }]} value={status} onChange={setStatus} label="حالة المرشحين" />{group ? <NativePicker label="التصنيف" value={group.id} onChange={setGroupId} options={(data?.groups ?? []).map(item => ({ value: item.id, label: item.name }))} /> : null}
      {data?.generatedAt ? <Label secondary>تاريخ النتائج: {new Date(data.generatedAt).toLocaleString('ar-SY')}</Label> : null}{data && group ? <TimeseriesChart key={`${group.id}:${status}`} title={`تقدم ${group.name}`} candidates={rows} history={data.history} /> : null}
      {podium.length ? <Section><Heading>أفضل ثلاثة</Heading><View style={{ flexDirection: 'row', gap: 12 }}>{podium.map(row => <View key={row.candidateId} style={{ flex: 1, gap: 8, alignItems: 'center' }}>{row.imageUrl ? <Image source={{ uri: row.imageUrl }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel={row.name} style={{ width: row.rank === 1 ? 72 : 58, height: row.rank === 1 ? 72 : 58, borderRadius: 36 }} /> : null}<Label style={{ fontWeight: '700' }}>#{row.rank}</Label><Label style={{ textAlign: 'center', fontSize: 13 }}>{row.name}</Label>{row.title ? <Label secondary style={{ textAlign: 'center', fontSize: 12 }}>{row.title}</Label> : null}</View>)}</View></Section> : null}
      <Heading>{group ? `قائمة ${group.name}` : 'الترتيب'}</Heading><NativeAction title="مشاركة رابط النتائج والتصفية" systemImage="square.and.arrow.up" onPress={() => { void shareText('نتائج تقييمات الجمهور', `https://syrian.zone/${slug === CORE_POLL_SLUG ? 'tierlist' : `polls/${slug}`}/leaderboard?status=${status}`).catch(reason => setError(reason instanceof Error ? reason.message : 'تعذّرت مشاركة الرابط')); }} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>}
    renderItem={({ item: row }) => <Section style={{ marginVertical: 7 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{row.imageUrl ? <Image source={{ uri: row.imageUrl }} contentFit="cover" cachePolicy="memory-disk" accessibilityLabel={row.name} style={{ width: 56, height: 56, borderRadius: 28 }} /> : null}<View style={{ flex: 1 }}><Label style={{ fontWeight: '700' }}>#{row.rank} {row.name}</Label>{row.title ? <Label secondary>{row.title}</Label> : null}</View></View><Label>النقاط: {row.score.toLocaleString('en-US')}، الأصوات: {row.votes.toLocaleString('en-US')}، المعدّل: {row.avg.toFixed(2)}</Label>{row.status === 'archived' ? <Label secondary>{['سابق', row.termEndedAt ? `حتى ${row.termEndedAt}` : null, row.archiveReason, row.successorId && successorNames.get(row.successorId) ? `خلفه ${successorNames.get(row.successorId)}` : null].filter(Boolean).join('، ')}</Label> : null}</Section>}
    ListEmptyComponent={!resource.loading ? <EmptyState title="لا توجد نتائج لهذا التصنيف" /> : <View />} />} />;
}
// PORT STATUS: source resources/js/Pages/Polls/Leaderboard.tsx; confidence medium; todos 0.
