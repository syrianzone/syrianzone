import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/contexts/AuthContext';
import { placesApi } from '@/features/Places/_lib/api';
import type { AdminPlace } from '@/features/Places/_lib/types';
import {
  invalidatePlaceQueries,
  placeQueryKeys,
} from '@/features/Places/_lib/queries';

import {
  canModeratePlaces,
  type PlaceModerationStatus,
  placeModerationStatusLabel,
} from './model';
import { PlaceReviewCard } from './PlaceReviewCard';

const placeStatuses: readonly PlaceModerationStatus[] = [
  'pending',
  'approved',
  'rejected',
  'all',
];

export default function AdminPlacesScreen() {
  const { loading: authLoading, login, user } = useAuth();
  const queryClient = useQueryClient();
  const permitted = canModeratePlaces(user?.role);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<PlaceModerationStatus>('pending');
  const query = useQuery({
    enabled: permitted,
    queryFn: async () => {
      const result = await placesApi.adminListPlaces(status, page);
      if (result.data.length === 0 && result.current_page > result.last_page) {
        setPage(Math.max(result.last_page, 1));
      }
      return result;
    },
    queryKey: placeQueryKeys.admin(user?.id, status, page),
  });

  if (authLoading) {
    return (
      <Screen title="إدارة أماكن مشوار">
        <AppText color="muted">جارٍ التحقق من الحساب...</AppText>
      </Screen>
    );
  }
  if (!user) {
    return (
      <Screen title="إدارة أماكن مشوار">
        <QueryState detail="سجل الدخول للوصول إلى المراجعة." type="error" />
        <AppButton onPress={() => void login()}>تسجيل الدخول</AppButton>
      </Screen>
    );
  }
  if (!permitted) {
    return (
      <Screen title="إدارة أماكن مشوار">
        <QueryState detail="لا يملك هذا الحساب صلاحية مراجعة الأماكن." type="error" />
      </Screen>
    );
  }

  const run = async (id: number, operation: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await operation();
      await invalidatePlaceQueries(queryClient);
    } catch (cause) {
      Alert.alert(
        'تعذر إكمال العملية',
        cause instanceof Error ? cause.message : 'حاول مرة أخرى.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (place: AdminPlace) => {
    Alert.alert('حذف المكان نهائياً؟', `سيتم حذف ${place.name} وجميع صوره.`, [
      { style: 'cancel', text: 'إلغاء' },
      {
        onPress: () => void run(place.id, () => placesApi.adminDeletePlace(place.id)),
        style: 'destructive',
        text: 'حذف',
      },
    ]);
  };

  const result = query.data;
  return (
    <Screen
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      subtitle="اعتماد المشاركات وتعديل بياناتها وصورها"
      title="إدارة أماكن مشوار"
    >
      <View style={styles.statuses}>
        {placeStatuses.map((value) => (
          <AppButton
            key={value}
            onPress={() => {
              setStatus(value);
              setPage(1);
            }}
            variant={status === value ? 'primary' : 'secondary'}
          >
            {placeModerationStatusLabel(value)}
          </AppButton>
        ))}
      </View>
      {result ? (
        <AppText color="muted">
          النتائج: {result.total.toLocaleString('ar-SY')}
        </AppText>
      ) : null}
      {query.isLoading ? <AppText color="muted">جارٍ تحميل المشاركات...</AppText> : null}
      {query.isError ? <QueryState onRetry={() => void query.refetch()} type="error" /> : null}
      {!query.isLoading && !query.isError && result?.data.length === 0 ? <QueryState detail="لا توجد أماكن." type="empty" /> : null}
      {result?.data.map((place) => (
        <PlaceReviewCard
          busy={busyId === place.id}
          key={place.id}
          onApprove={() => run(place.id, () => placesApi.adminApprove(place.id))}
          onChanged={() => invalidatePlaceQueries(queryClient)}
          onDelete={() => confirmDelete(place)}
          onReject={(reason) => run(place.id, () => placesApi.adminReject(place.id, reason))}
          place={place}
        />
      ))}
      {result && result.last_page > 1 ? (
        <View style={styles.pagination}>
          <AppButton
            disabled={page <= 1 || query.isFetching}
            onPress={() => setPage((current) => current - 1)}
            variant="secondary"
          >
            السابق
          </AppButton>
          <AppText color="muted">{result.current_page} / {result.last_page}</AppText>
          <AppButton
            disabled={page >= result.last_page || query.isFetching}
            onPress={() => setPage((current) => current + 1)}
            variant="secondary"
          >
            التالي
          </AppButton>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pagination: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8, justifyContent: 'center' },
  statuses: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Admin/Places/Index.tsx (187 lines)
  confidence: high
  todos:      0
  notes:      Native moderation keeps role gates, status filters, totals, errors, refresh, page clamps, paging, and every place action.
*/
