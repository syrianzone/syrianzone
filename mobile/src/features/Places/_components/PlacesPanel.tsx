import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { useAuth } from '@/contexts/AuthContext';
import { useAppTheme } from '@/contexts/ThemeContext';

import { placesApi } from '../_lib/api';
import type { PlaceListItem } from '../_lib/types';
import { PlaceCard } from './PlaceCard';
import { PlaceDetailView } from './PlaceDetailView';

type PanelTab = 'mine' | 'places' | 'saves';

export function PlacesPanel({ hasMore, loading, onLoadMore, onSelect, places, selectedId }: { hasMore: boolean; loading: boolean; onLoadMore: () => void; onSelect: (id: number | null) => void; places: readonly PlaceListItem[]; selectedId: number | null }) {
  const { user } = useAuth();
  const { theme } = useAppTheme();
  const [tab, setTab] = useState<PanelTab>('places');
  const privateQuery = useQuery({ enabled: Boolean(user && tab !== 'places'), queryFn: () => tab === 'mine' ? placesApi.myPlaces() : placesApi.mySaves(), queryKey: ['places', tab] });
  if (selectedId !== null) {
    return <PlaceDetailView onClose={() => onSelect(null)} placeId={selectedId} />;
  }
  const visible = tab === 'places' ? places : privateQuery.data?.data ?? [];
  return (
    <View style={styles.root}>
      {user ? <View accessibilityRole="tablist" style={styles.tabs}>{([['places', 'الأماكن'], ['saves', 'محفوظاتي'], ['mine', 'مساهماتي']] as const).map(([key, label]) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === key }} key={key} onPress={() => setTab(key)} style={[styles.tab, { borderColor: tab === key ? theme.palette.primary : theme.palette.border }]}><AppText variant="caption">{label}</AppText></Pressable>)}</View> : null}
      {privateQuery.isError && tab !== 'places' ? <QueryState detail="تعذر تحميل قائمتك." onRetry={() => void privateQuery.refetch()} type="error" /> : null}
      {visible.map((place) => <PlaceCard key={place.id} onPress={(id) => onSelect(id)} place={place} />)}
      {!loading && visible.length === 0 ? <QueryState detail="لا توجد أماكن." type="empty" /> : null}
      {tab === 'places' && hasMore ? <AppButton loading={loading} onPress={onLoadMore} variant="secondary">عرض المزيد</AppButton> : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { gap: 10 }, tab: { borderBottomWidth: 2, paddingHorizontal: 8, paddingVertical: 7 }, tabs: { flexDirection: 'row', gap: 8 } });

/*
PORT STATUS
  source:     resources/js/Pages/Places/_components/PlacesPanel.tsx (172 lines)
  confidence: high
  todos:      0
  notes:      Native panel retains public, saved, contributed, detail, empty, paging, and error states.
*/
