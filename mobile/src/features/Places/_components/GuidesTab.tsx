import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { useAppTheme } from '@/contexts/ThemeContext';

import { discovery } from '../_lib/discovery';
import type { Guide, GuideFilter, GuidesSort } from '../_lib/types';
import { GuideProfileCard } from './GuideProfileCard';
import { LevelBadge } from './LevelBadge';
import { MilestonesSheet } from './MilestonesSheet';

const SORTS: readonly { label: string; value: GuidesSort }[] = [
  { label: 'الأعلى نقاطاً', value: 'points' },
  { label: 'الأكثر مساهمة', value: 'submissions' },
  { label: 'الأكثر حفظاً', value: 'saves' },
  { label: 'النشطون مؤخراً', value: 'recent' },
];

export function GuidesTab({
  onSelectGuide,
}: {
  onSelectGuide: (guide: GuideFilter) => void;
}) {
  const { theme } = useAppTheme();
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const [profile, setProfile] = useState<Guide | null>(null);
  const [sort, setSort] = useState<GuidesSort>('points');
  const query = useQuery({
    queryFn: () => discovery.guides(sort),
    queryKey: ['places', 'guides', sort],
    retry: false,
  });
  const guides = query.data?.guides ?? [];

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText variant="heading">المرشدون المحليون</AppText>
        <AppButton onPress={() => setMilestonesOpen(true)} variant="ghost">الرتب</AppButton>
      </View>
      <View style={styles.sorts}>
        {SORTS.map((item) => {
          const active = item.value === sort;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              key={item.value}
              onPress={() => setSort(item.value)}
              style={[
                styles.sort,
                {
                  backgroundColor: active ? theme.palette.primary : theme.palette.surface,
                  borderColor: theme.palette.border,
                },
              ]}
            >
              <AppText style={active ? { color: theme.palette.primaryForeground } : undefined} variant="caption">
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {query.isError ? (
        <View style={styles.state}>
          <AppText color="danger">تعذر تحميل المرشدين</AppText>
          <AppButton onPress={() => void query.refetch()} variant="secondary">إعادة المحاولة</AppButton>
        </View>
      ) : query.isLoading ? (
        <AppText color="muted">جارٍ تحميل الأدلة...</AppText>
      ) : guides.length === 0 ? (
        <AppText color="muted">لا يوجد مساهمون بعد</AppText>
      ) : guides.map((guide) => (
        <Pressable
          accessibilityLabel={`فتح ملف ${guide.name}`}
          accessibilityRole="button"
          key={guide.user_id}
          onPress={() => setProfile(guide)}
          style={[styles.guide, { borderColor: theme.palette.border }]}
        >
          <AppText color="muted" style={styles.rank} variant="label">{guide.rank}</AppText>
          <Avatar label={guide.name} uri={guide.avatar_url} />
          <View style={styles.copy}>
            <View style={styles.name}>
              <AppText numberOfLines={1} variant="label">{guide.name}</AppText>
              <LevelBadge level={guide.level} showLabel />
            </View>
            <AppText color="muted" variant="caption">
              {guide.points} نقطة · {guide.approved_count} مساهمة · {guide.saves_total} حفظ
              {sort === 'recent' ? ` · ${guide.recent_count} خلال 30 يوماً` : ''}
            </AppText>
          </View>
        </Pressable>
      ))}
      <MilestonesSheet onClose={() => setMilestonesOpen(false)} open={milestonesOpen} />
      <GuideProfileCard
        guide={profile}
        onClose={() => setProfile(null)}
        onShowContributions={(guide) => {
          setProfile(null);
          onSelectGuide(guide);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  copy: { flex: 1, gap: 2 },
  guide: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row-reverse', gap: 10, minHeight: 54, paddingVertical: 7 },
  header: { alignItems: 'center', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  name: { alignItems: 'center', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  rank: { textAlign: 'center', width: 24 },
  root: { gap: 10 },
  sort: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  sorts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  state: { alignItems: 'center', gap: 9, paddingVertical: 12 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/GuidesTab.tsx (120 lines)
  confidence: high
  todos:      0
  notes:      Points-first ranking, named levels, profiles, ranks, filtering, loading, error, and retry preserve the guides board.
*/
