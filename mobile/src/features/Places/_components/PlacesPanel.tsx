import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';
import { placeQueryKeys } from '../_lib/queries';
import type {
  MyPlace,
  Paginated,
  PlaceListItem,
  PlaceStatus,
} from '../_lib/types';
import { GuidesTab } from './GuidesTab';
import { ManagePlaceDialog } from './ManagePlaceDialog';
import { PlaceCard } from './PlaceCard';
import { PlaceDetailView } from './PlaceDetailView';

type PanelTab = 'guides' | 'mine' | 'places' | 'saves';

const STATUS_LABELS: Record<PlaceStatus, string> = {
  approved: 'مقبول',
  pending: 'قيد المراجعة',
  rejected: 'مرفوض',
};

function isMyPlace(place: PlaceListItem | MyPlace): place is MyPlace {
  return 'status' in place;
}

export function PlacesPanel({
  hasMore,
  loading,
  onLoadMore,
  onMutated,
  onSelect,
  places,
  selectedId,
}: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onMutated: () => Promise<void>;
  onSelect: (id: number | null) => void;
  places: readonly PlaceListItem[];
  selectedId: number | null;
}) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const [managing, setManaging] = useState<MyPlace | null>(null);
  const [resubmitError, setResubmitError] = useState<string | null>(null);
  const [resubmittingId, setResubmittingId] = useState<number | null>(null);
  const [tab, setTab] = useState<PanelTab>('places');
  const privateQuery = useInfiniteQuery<Paginated<MyPlace | PlaceListItem>>({
    enabled: Boolean(user && (tab === 'mine' || tab === 'saves')),
    getNextPageParam: (page) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => tab === 'mine' ? placesApi.myPlaces(Number(pageParam)) : placesApi.mySaves(Number(pageParam)),
    queryKey: placeQueryKeys.privateList(user?.id, tab),
  });

  if (selectedId !== null) {
    return <PlaceDetailView key={selectedId} onClose={() => onSelect(null)} placeId={selectedId} />;
  }

  const refreshAfterOwnerMutation = async () => {
    await Promise.all([onMutated(), privateQuery.refetch()]);
  };

  if (managing) {
    return (
      <ManagePlaceDialog
        key={managing.id}
        onClose={() => setManaging(null)}
        onUpdated={refreshAfterOwnerMutation}
        place={managing}
      />
    );
  }

  const resubmit = async (place: MyPlace) => {
    if (resubmittingId !== null) {
      return;
    }
    setResubmittingId(place.id);
    setResubmitError(null);
    try {
      await placesApi.resubmitMyPlace(place.id);
      await refreshAfterOwnerMutation();
    } catch (cause) {
      setResubmitError(cause instanceof Error ? cause.message : 'تعذرت إعادة إرسال المكان.');
    } finally {
      setResubmittingId(null);
    }
  };

  const privatePlaces = privateQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const visible = tab === 'places' ? places : tab === 'guides' ? [] : privatePlaces;
  const listLoading = tab === 'places' ? loading : tab === 'guides' ? false : privateQuery.isLoading;
  const listFailed = (tab === 'mine' || tab === 'saves') && privateQuery.isError;
  const canLoadMore = tab === 'places' ? hasMore : tab === 'guides' ? false : privateQuery.hasNextPage;
  const loadMore = tab === 'places' ? onLoadMore : () => void privateQuery.fetchNextPage();

  return (
    <View style={styles.root}>
      <View accessibilityRole="tablist" style={styles.tabs}>
          {([
            ['places', 'الأماكن'],
            ...(user ? ([['saves', 'محفوظاتي'], ['mine', 'مساهماتي']] as const) : []),
            ['guides', 'مرشدون'],
          ] as readonly (readonly [PanelTab, string])[]).map(([key, label]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === key }}
              key={key}
              onPress={() => setTab(key)}
              style={[styles.tab, { borderColor: tab === key ? theme.palette.primary : theme.palette.border }]}
            >
              <AppText variant="caption">{label}</AppText>
            </Pressable>
          ))}
      </View>
      {tab === 'guides' ? <GuidesTab /> : null}
      {listFailed ? <QueryState detail="تعذر تحميل قائمتك." onRetry={() => void privateQuery.refetch()} type="error" /> : null}
      {resubmitError ? <AppText color="danger">{resubmitError}</AppText> : null}
      {tab !== 'guides' && !listFailed ? visible.map((place) => (
        <View key={place.id} style={styles.place}>
          <PlaceCard onPress={(id) => onSelect(id)} place={place} />
          {isMyPlace(place) ? (
            <View style={styles.ownerSection}>
              <View style={styles.status}>
                <AppText color={place.status === 'rejected' ? 'danger' : 'muted'} variant="caption">
                  {STATUS_LABELS[place.status]}
                </AppText>
                <AppButton onPress={() => setManaging(place)} variant="ghost">إدارة</AppButton>
              </View>
              {place.status === 'rejected' && place.rejection_reason ? (
                <View style={styles.rejection}>
                  <AppText color="muted" style={styles.grow} variant="caption">{place.rejection_reason}</AppText>
                  <AppButton
                    loading={resubmittingId === place.id}
                    onPress={() => void resubmit(place)}
                    variant="secondary"
                  >
                    إعادة إرسال
                  </AppButton>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      )) : null}
      {tab !== 'guides' && !listLoading && !listFailed && visible.length === 0 ? <QueryState detail="لا توجد أماكن." type="empty" /> : null}
      {canLoadMore ? (
        <AppButton
          loading={tab === 'places' ? loading : privateQuery.isFetchingNextPage}
          onPress={loadMore}
          variant="secondary"
        >
          عرض المزيد
        </AppButton>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  ownerSection: { gap: 5 },
  place: { gap: 4 },
  rejection: { alignItems: 'center', flexDirection: 'row-reverse', gap: 8 },
  root: { gap: 10 },
  status: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4 },
  tab: { borderBottomWidth: 2, paddingHorizontal: 8, paddingVertical: 7 },
  tabs: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
});

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlacesPanel.tsx (248 lines)
  confidence: high
  todos:      0
  notes:      Native public, saved, owner management, resubmission, guides, detail, paging, and error states preserve the panel.
*/
