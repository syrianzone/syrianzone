import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, type ScrollView } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { QueryState } from '@/components/ui/QueryState';
import { Screen } from '@/components/ui/Screen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';

import { FilterBar } from './_components/FilterBar';
import { PhotoGrid } from './_components/PhotoGrid';
import { PlacesMap } from './_components/PlacesMap';
import { PlacesPanel } from './_components/PlacesPanel';
import { SubmitSheet } from './_components/SubmitSheet';
import {
  placesViewFromParam,
  type PlacesView,
  ViewToggle,
} from './_components/ViewToggle';
import { placesApi } from './_lib/api';
import {
  invalidatePlaceQueries,
  placeQueryKeys,
} from './_lib/queries';
import type {
  GridPhoto,
  LatLng,
  Paginated,
  PlaceCategory,
  PlaceListItem,
} from './_lib/types';
import {
  filterPlaceFeatures,
  isGeoSuggestionQuery,
  isPointInSyria,
  parseLatLng,
} from './model';

export default function PlacesIndex() {
  const { theme } = useAppTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    place?: string | string[];
    view?: string | string[];
  }>();
  const [addMode, setAddMode] = useState(false);
  const [category, setCategory] = useState<PlaceCategory | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [focus, setFocus] = useState<{ key: number; lat: number; lng: number; zoom?: number } | null>(null);
  const [highlight, setHighlight] = useState<LatLng | null>(null);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [submitPoint, setSubmitPoint] = useState<LatLng | null>(null);
  const [view, setView] = useState<PlacesView>(() => placesViewFromParam(params.view));
  const focusKey = useRef(0);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openedDeepLink = useRef<number | null>(null);
  const pendingDetailScroll = useRef(false);
  const screenRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => () => {
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
  }, []);

  const coordCandidate = useMemo(() => parseLatLng(query), [query]);
  const serverQuery = parseLatLng(debouncedQuery) ? '' : debouncedQuery;
  const mapQuery = useQuery({
    queryFn: placesApi.mapData,
    queryKey: placeQueryKeys.map(user?.id),
  });
  const listQuery = useInfiniteQuery({
    getNextPageParam: (page: Paginated<PlaceListItem>) => page.current_page < page.last_page ? page.current_page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => placesApi.listPlaces({
      category: category ?? undefined,
      page: pageParam,
      q: serverQuery || undefined,
    }),
    queryKey: placeQueryKeys.list(user?.id, category, serverQuery),
  });
  const geoQuery = useQuery({
    enabled: isGeoSuggestionQuery(debouncedQuery),
    queryFn: () => placesApi.geocode(debouncedQuery),
    queryKey: ['places', 'geocode', debouncedQuery],
    staleTime: 60 * 60 * 1_000,
  });
  const features = filterPlaceFeatures(mapQuery.data, category, query);
  const places = (listQuery.data?.pages as Paginated<PlaceListItem>[] | undefined)?.flatMap((page) => page.data) ?? [];

  const flyTo = (point: LatLng, zoom = 15) => {
    setFocus({ ...point, key: ++focusKey.current, zoom });
  };

  useEffect(() => {
    if (selectedId !== null) {
      pendingDetailScroll.current = true;
    }
  }, [selectedId]);

  useEffect(() => {
    const raw = Array.isArray(params.place) ? params.place[0] : params.place;
    if (!raw || !/^\d+$/.test(raw)) {
      return;
    }
    const id = Number(raw);
    if (id <= 0 || openedDeepLink.current === id) {
      return;
    }
    openedDeepLink.current = id;
    setSelectedId(id);
    void placesApi.getPlace(id)
      .then((place) => flyTo({ lat: place.lat, lng: place.lng }))
      .catch(() => {
        setSelectedId((current) => current === id ? null : current);
        Alert.alert('تعذر فتح المكان');
      });
  }, [params.place]);

  const refresh = async () => {
    await Promise.all([mapQuery.refetch(), listQuery.refetch()]);
  };

  const refreshAfterMutation = async () => {
    await invalidatePlaceQueries(queryClient);
  };

  const handleMapPress = (point: LatLng) => {
    if (!addMode) {
      setSelectedId(null);
      return;
    }
    if (!isPointInSyria(point)) {
      Alert.alert('النقطة خارج حدود سوريا');
      return;
    }
    setSubmitPoint(point);
    setAddMode(false);
  };

  const handleSelectResult = (place: PlaceListItem) => {
    setSelectedId(place.id);
    setAddMode(false);
    flyTo({ lat: place.lat, lng: place.lng });
  };

  const handleGoToCoord = (point: LatLng) => {
    flyTo(point);
    setHighlight(point);
    if (highlightTimer.current) {
      clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = setTimeout(() => setHighlight(null), 6000);
  };

  const selectPin = (id: number) => {
    setSelectedId(id);
    setAddMode(false);
  };

  const changeView = (next: PlacesView) => {
    setView(next);
    router.setParams({ view: next === 'grid' ? 'grid' : undefined });
  };

  const selectGridPhoto = (photo: GridPhoto) => {
    changeView('map');
    setSelectedId(photo.place.id);
    flyTo({ lat: photo.place.lat, lng: photo.place.lng });
  };

  const searchPending = query.trim() !== debouncedQuery;
  const searchResults = !query.trim() || coordCandidate || searchPending
    ? []
    : places.slice(0, 8);

  return (
    <Screen
      onContentSizeChange={() => {
        if (pendingDetailScroll.current) {
          pendingDetailScroll.current = false;
          screenRef.current?.scrollToEnd({ animated: true });
        }
      }}
      onRefresh={() => void refresh()}
      refreshing={mapQuery.isFetching || listQuery.isFetching}
      scrollViewRef={screenRef}
      subtitle="خريطة تفاعلية لأماكن تستحق المشوار في سوريا"
      title="مشوار"
    >
      <FilterBar
        category={category}
        coordCandidate={coordCandidate}
        geoResults={coordCandidate || searchPending ? [] : (geoQuery.data?.suggestions ?? [])}
        onCategoryChange={setCategory}
        onGoToCoord={handleGoToCoord}
        onQueryChange={setQuery}
        onSelectGeo={(suggestion) => handleGoToCoord({ lat: suggestion.lat, lng: suggestion.lng })}
        onSelectResult={handleSelectResult}
        query={query}
        results={searchResults}
        resultsLoading={listQuery.isFetching || searchPending || geoQuery.isFetching}
      />
      <ViewToggle onChange={changeView} view={view} />
      <PhotoGrid active={view === 'grid'} onPhotoClick={selectGridPhoto} />
      {view === 'map' ? (
        <>
          <AppButton
            icon={addMode ? <X color={theme.palette.foreground} size={18} /> : <Plus color={theme.palette.foreground} size={18} />}
            onPress={() => {
              setAddMode((current) => !current);
              setSubmitPoint(null);
            }}
            variant={addMode ? 'danger' : 'primary'}
          >
            {addMode ? 'إلغاء الإضافة' : 'أضف مكاناً'}
          </AppButton>
          {mapQuery.isError ? <QueryState detail="تعذر تحميل خريطة الأماكن." onRetry={() => void mapQuery.refetch()} type="error" /> : null}
          <PlacesMap
            addMode={addMode}
            data={features}
            focus={focus}
            highlight={highlight}
            onMapPress={handleMapPress}
            onSelect={selectPin}
            selectedId={selectedId}
          />
        </>
      ) : null}
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
            Alert.alert('تم إرسال المكان وسيظهر بعد الموافقة');
            void refreshAfterMutation();
          }}
        />
      ) : null}
      {submitPoint ? (
        <AppButton
          onPress={() => Alert.alert(
            'إلغاء الإضافة؟',
            'سيتم تجاهل ما أدخلته.',
            [
              { style: 'cancel', text: 'متابعة التحرير' },
              { onPress: () => setSubmitPoint(null), style: 'destructive', text: 'إلغاء الإضافة' },
            ],
          )}
          variant="ghost"
        >
          إلغاء الإضافة
        </AppButton>
      ) : null}
      {view === 'map' ? (
        <>
          {listQuery.isError ? <QueryState detail="تعذر تحميل قائمة الأماكن." onRetry={() => void listQuery.refetch()} type="error" /> : null}
          <PlacesPanel
            hasMore={Boolean(listQuery.hasNextPage)}
            loading={listQuery.isLoading || listQuery.isFetchingNextPage}
            onLoadMore={() => void listQuery.fetchNextPage()}
            onMutated={refreshAfterMutation}
            onSelect={setSelectedId}
            places={places}
            selectedId={selectedId}
          />
        </>
      ) : null}
    </Screen>
  );
}

/*
PORT STATUS
  source:     resources/js/Pages/Places/Index.tsx (317 lines)
  confidence: high
  todos:      0
  notes:      Native map, gallery, local and Google search, deep links, paging, pin mode, submission, guides, and owner management preserve the screen.
*/
