import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';

import { FilterBar } from './_components/FilterBar';
import { PlacesMap } from './_components/PlacesMap';
import { PlacesPanel } from './_components/PlacesPanel';
import { SubmitSheet } from './_components/SubmitSheet';
import { placesApi } from './_lib/api';
import type { LatLng, Paginated, PlaceCategory, PlaceListItem } from './_lib/types';
import { filterPlaceFeatures } from './model';

export default function PlacesIndex() {
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitPoint, setSubmitPoint] = useState<LatLng | null>(null);
  const mapQuery = useQuery({ queryFn: placesApi.mapData, queryKey: ['places', 'map'] });
  const listQuery = useInfiniteQuery({
    getNextPageParam: (page: Paginated<PlaceListItem>) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => placesApi.listPlaces({ category: category ?? undefined, page: pageParam, q: search.trim() || undefined }),
    queryKey: ['places', 'list', category, search],
  });
  const features = filterPlaceFeatures(mapQuery.data, category, search);
  const places = (listQuery.data?.pages as Paginated<PlaceListItem>[] | undefined)?.flatMap((page) => page.data) ?? [];
  const refresh = async () => { await Promise.all([mapQuery.refetch(), listQuery.refetch()]); };
  return (
    <Screen onRefresh={() => void refresh()} refreshing={mapQuery.isFetching || listQuery.isFetching} subtitle="اكتشف أماكن سوريا وساهم بصورك" title="أماكن خفية">
      <FilterBar category={category} onCategory={setCategory} onSearch={setSearch} search={search} />
      <AppText color="muted" variant="caption">اضغط مطولًا على الخريطة لإضافة مكان.</AppText>
      {mapQuery.isError ? <QueryState detail="تعذر تحميل خريطة الأماكن." onRetry={() => void mapQuery.refetch()} type="error" /> : null}
      <PlacesMap data={features} onAdd={setSubmitPoint} onSelect={setSelectedId} selectedId={selectedId} />
      {submitPoint ? (
        <SubmitSheet
          key={`${submitPoint.lat}:${submitPoint.lng}`}
          latitude={submitPoint.lat}
          longitude={submitPoint.lng}
          onSelectExisting={(id) => {
            setSelectedId(id);
            setSubmitPoint(null);
          }}
          onSubmitted={(id) => {
            setSelectedId(id);
            setSubmitPoint(null);
            void refresh();
          }}
        />
      ) : null}
      {submitPoint ? <AppButton onPress={() => setSubmitPoint(null)} variant="ghost">إلغاء الإضافة</AppButton> : null}
      {listQuery.isError ? <QueryState detail="تعذر تحميل قائمة الأماكن." onRetry={() => void listQuery.refetch()} type="error" /> : null}
      <PlacesPanel hasMore={listQuery.hasNextPage} loading={listQuery.isFetchingNextPage} onLoadMore={() => void listQuery.fetchNextPage()} onSelect={setSelectedId} places={places} selectedId={selectedId} />
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Places/Index.tsx (165 lines)
  confidence: high
  todos:      0
  notes:      Native map, filtered paging, selection, long-press submission, refresh, and account lists preserve the full screen flow.
*/
