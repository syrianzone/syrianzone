import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/contexts/ThemeContext';

import { discovery } from '../_lib/discovery';
import type { GuidesSort } from '../_lib/types';

const SORTS: readonly { label: string; value: GuidesSort }[] = [
  { label: 'الأكثر مساهمة', value: 'submissions' },
  { label: 'الأكثر حفظاً', value: 'saves' },
  { label: 'النشطون مؤخراً', value: 'recent' },
];

export function GuidesTab() {
  const { theme } = useAppTheme();
  const [sort, setSort] = useState<GuidesSort>('submissions');
  const query = useQuery({
    queryFn: () => discovery.guides(sort),
    queryKey: ['places', 'guides', sort],
    retry: false,
  });
  const guides = query.data?.guides ?? [];

  return (
    <View style={styles.root}>
      <AppText variant="heading">المرشدون المحليون</AppText>
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
        <View key={guide.user_id} style={[styles.guide, { borderColor: theme.palette.border }]}>
          <AppText color="muted" style={styles.rank} variant="label">{guide.rank}</AppText>
          {guide.avatar_url ? (
            <Image accessibilityLabel={guide.name} source={guide.avatar_url} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.fallback, { backgroundColor: theme.palette.surfaceRaised }]}>
              <AppText variant="label">{guide.name.slice(0, 1)}</AppText>
            </View>
          )}
          <View style={styles.copy}>
            <AppText numberOfLines={1} variant="label">{guide.name}</AppText>
            <AppText color="muted" variant="caption">
              {guide.approved_count} مساهمة · {guide.saves_total} حفظ
              {sort === 'recent' ? ` · ${guide.recent_count} خلال 30 يوماً` : ''}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { borderRadius: 18, height: 36, width: 36 },
  copy: { flex: 1, gap: 2 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  guide: { alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row-reverse', gap: 10, minHeight: 54, paddingVertical: 7 },
  rank: { textAlign: 'center', width: 24 },
  root: { gap: 10 },
  sort: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
  sorts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  state: { alignItems: 'center', gap: 9, paddingVertical: 12 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/GuidesTab.tsx (93 lines)
  confidence: high
  todos:      0
  notes:      Native ranking modes, avatars, counts, loading, empty, error, and retry states preserve the guides board.
*/
