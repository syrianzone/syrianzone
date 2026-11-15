import { useCallback, useState, type ReactNode } from 'react';
import { FlatList, Modal, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import { contentStyle, EmptyState, Heading, Label, RequestStatus, Section } from '../../components';
import { useResource } from '../../resource';
import { NativeAction, NativePicker, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { GuideBadge } from './Badge';
import { decodeGuides, milestones, nextRank, rankName, type Guide, type GuideSort } from './model';

function Avatar({ guide, size = 52 }: { guide: Guide; size?: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return guide.avatar && !failed ? <Image source={{ uri: guide.avatar }} accessibilityLabel={guide.name} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" cachePolicy="memory-disk" /> : <NativeSymbol name="person.crop.circle" size={size} />;
}
export function GuidesScreen({ onSelectGuide, header }: Partial<FeatureScreenProps> & { onSelectGuide?(guide: { id: number; name: string }): void; header?: ReactNode } = {}): React.JSX.Element {
  const { colors } = useTheme(), navigation = useFeatureNavigation();
  const [sort, setSort] = useState<GuideSort>('points'), [profile, setProfile] = useState<Guide | null>(null), [showRanks, setShowRanks] = useState(false);
  const resource = useResource(useCallback((signal: AbortSignal) => api.request('guides', decodeGuides, { signal, params: { sort } }), [sort]));
  const next = profile ? nextRank(profile.points) : null;
  const showContributions = (guide: Guide): void => { setProfile(null); if (onSelectGuide) onSelectGuide(guide); else navigation.open('places', { guideId: String(guide.id), guideName: guide.name }); };
  return <>
    <FlatList data={resource.data ?? []} keyExtractor={guide => String(guide.id)} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListHeaderComponent={<View style={{ gap: 12, marginBottom: 12 }}>{header}<Heading>المرشدون المحليون</Heading><NativeAction title="الرتب" onPress={() => setShowRanks(true)} /><NativePicker<GuideSort> label="ترتيب المرشدين" value={sort} onChange={setSort} options={[{ value: 'points', label: 'الأعلى نقاطاً' }, { value: 'submissions', label: 'الأكثر مساهمة' }, { value: 'saves', label: 'الأكثر حفظاً' }, { value: 'recent', label: 'النشطون مؤخراً' }]} /><RequestStatus resource={resource} /></View>}
      ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا يوجد مساهمون بعد" /> : undefined}
      renderItem={({ item }) => <Section><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Avatar guide={item} /><View style={{ flex: 1, gap: 6 }}><Label>{item.rank}. {item.name}</Label><GuideBadge level={item.level} /></View></View><Label secondary>{item.points} نقطة · {item.approved} مساهمة · {item.saves} حفظ{sort === 'recent' ? ` · ${item.recent} خلال 30 يوماً` : ''}</Label><NativeAction title="عرض الملف" onPress={() => setProfile(item)} /></Section>} />
    <Modal visible={profile !== null || showRanks} presentationStyle="pageSheet" onRequestClose={() => { setProfile(null); setShowRanks(false); }}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={contentStyle}><NativeAction title="تم" onPress={() => { setProfile(null); setShowRanks(false); }} />
      {profile ? <><Avatar guide={profile} size={90} /><Heading>{profile.name}</Heading><GuideBadge level={profile.level} /><Heading subtitle="نقطة">{profile.points}</Heading><Label>{profile.approved} مساهمة · {profile.saves} حفظ · {profile.recent} خلال آخر 30 يوماً</Label>{next ? <Section><Label>{rankName(next.level)} عند {next.points} نقطة</Label><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: next.points, now: Math.min(profile.points, next.points) }} style={{ height: 10, backgroundColor: colors.elevated, borderRadius: 8, overflow: 'hidden' }}><View style={{ height: '100%', width: `${Math.min(100, Math.round(profile.points / next.points * 100))}%`, backgroundColor: colors.accent }} /></View></Section> : <Label>أعلى رتبة، {rankName(profile.level)}</Label>}<NativeAction title="عرض المساهمات على الخريطة" onPress={() => showContributions(profile)} /></> : <><Heading subtitle="اجمع النقاط بمساهماتك في مشوار وارتقِ في المستويات.">مستويات مشوار</Heading><Section><Label>مكان مقبول: 15 نقطة</Label><Label>كل صورة على مكان مقبول: 5 نقاط</Label><Label>وصف وافٍ (200 حرف أو أكثر): 5 نقاط إضافية</Label><Label>كل حفظ يحصل عليه مكانك: نقطة واحدة</Label></Section>{milestones.map(row => <Section key={row.level}><GuideBadge level={row.level} /><Label>{row.points} نقطة</Label></Section>)}</>}
    </ScrollView></SafeAreaView></Modal>
  </>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/GuidesTab.tsx,GuideProfileCard.tsx,MilestonesSheet.tsx; confidence medium; todos 1 native ranking/profile/navigation verification.
