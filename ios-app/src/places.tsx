import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, ScrollView, Share, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Picker, Text as NativeText } from '@expo/ui/swift-ui';
import { accessibilityLabel, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { api, type PlacesQuery } from './api';
import { matchesSearch, placeCategories, type Page, type Place } from './domain';
import { AdaptivePanes, EmptyState, Heading, Label, Photo, RequestStatus, Row, SearchField, Section, contentStyle } from './components';
import { MapView, type MapPin } from './MapView';
import { directionsUrl } from './map-data';
import type { RootNavigation, RootRoutes, TabRoutes } from './navigation';
import { useResource, type Resource } from './resource';
import { useAppState } from './state';
import { NativeAction, NativeSegmented, NativeThemeHost } from './ui/native';
import { useTheme } from './ui/theme';

function usePlacePages(query: PlacesQuery): Resource<Page<Place>> & { more(): void; loadingMore: boolean } {
  const [data, setData] = useState<Page<Place> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const fetching = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    const current = ++generation.current;
    fetching.current = true;
    setData(null); setLoading(true); setLoadingMore(false); setError(null);
    api.places({ ...query, page: 1 }, controller.signal).then(page => {
      if (current === generation.current && !controller.signal.aborted) setData(page);
    }).catch((reason: unknown) => {
      if (current === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل الأماكن.');
    }).finally(() => {
      if (current === generation.current && !controller.signal.aborted) { fetching.current = false; setLoading(false); }
    });
    return () => { controller.abort(); active.current?.abort(); };
  }, [query, revision]);

  function more(): void {
    if (fetching.current || !data || data.currentPage >= data.lastPage) return;
    const current = generation.current;
    const controller = new AbortController();
    active.current = controller;
    fetching.current = true;
    setLoadingMore(true); setError(null);
    api.places({ ...query, page: data.currentPage + 1 }, controller.signal).then(page => {
      if (current !== generation.current || controller.signal.aborted) return;
      setData(previous => {
        const known = new Set(previous?.items.map(item => item.id));
        return { ...page, items: [...previous?.items ?? [], ...page.items.filter(item => !known.has(item.id))] };
      });
    }).catch((reason: unknown) => {
      if (current === generation.current && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحميل المزيد.');
    }).finally(() => {
      if (current === generation.current && !controller.signal.aborted) { fetching.current = false; setLoadingMore(false); }
    });
  }
  return { data, loading, loadingMore, error, more, reload: () => setRevision(value => value + 1) };
}

function PlaceCard({ place, open }: { place: Place; open(place: Place): void }): React.JSX.Element {
  const category = placeCategories.find(item => item.key === place.category)?.label;
  return <Section style={{ padding: 8, gap: 0 }}>
    <Photo url={place.thumbnail} label={place.name} height={170} />
    <Row title={place.name} {...(category ? { subtitle: category } : {})} onPress={() => open(place)} />
  </Section>;
}

function placesPins(places: readonly Place[]): MapPin[] {
  return places.map(place => ({ id: String(place.id), name: place.name, coordinate: place.coordinate }));
}

export function PlacesScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const { params } = useRoute<RouteProp<TabRoutes, 'Places'>>();
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState(() => placeCategories.find(item => item.key === params?.category)?.key ?? '');
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  const [display, setDisplay] = useState<'list' | 'map'>('list');
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(timer); }, [search]);
  const query = useMemo<PlacesQuery>(() => ({ query: debounced, category, sort }), [debounced, category, sort]);
  const resource = usePlacePages(query);
  const items = resource.data?.items ?? [];
  const pins = useMemo(() => placesPins(resource.data?.items ?? []), [resource.data]);
  const open = (place: Place): void => navigation.navigate('Place', { id: place.id, snapshot: place });
  const controls = <View style={{ gap: 12 }}>
    <Heading subtitle="أماكن تستحق المشوار في سوريا">مشوار</Heading>
    <SearchField value={search} onChange={setSearch} placeholder="ابحث عن مكان" />
    <NativeThemeHost matchContents={{ vertical: true }}>
      <Picker label="تصنيف المكان" selection={category} onSelectionChange={setCategory} modifiers={[pickerStyle('menu'), accessibilityLabel('تصنيف المكان')]}>
        <NativeText modifiers={[tag('')]}>كل التصنيفات</NativeText>
        {placeCategories.map(item => <NativeText key={item.key} modifiers={[tag(item.key)]}>{item.label}</NativeText>)}
      </Picker>
    </NativeThemeHost>
    <NativeSegmented label="ترتيب الأماكن" value={sort} onChange={setSort} options={[{ label: 'الأحدث', value: 'newest' }, { label: 'الأكثر حفظاً', value: 'popular' }]} />
  </View>;
  const footer = <View style={{ gap: 12 }}>
    {resource.loadingMore ? <ActivityIndicator color={colors.accent} accessibilityLabel="جارٍ تحميل المزيد" /> : null}
    {resource.data && resource.data.currentPage < resource.data.lastPage && !resource.loadingMore ? <NativeAction title="تحميل المزيد" onPress={resource.more} /> : null}
    {resource.data ? <Label secondary style={{ textAlign: 'center' }}>{`تم تحميل ${items.length} من ${resource.data.total} مكان`}</Label> : null}
  </View>;
  const list = (compact: boolean): React.JSX.Element => <FlatList
    data={items} keyExtractor={item => String(item.id)} renderItem={({ item }) => <PlaceCard place={item} open={open} />}
    contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
    keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" initialNumToRender={5} maxToRenderPerBatch={5}
    ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}>{controls}{compact ? displayControl : null}<RequestStatus resource={resource} /></View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد أماكن مطابقة" detail="جرّب كلمة بحث أو تصنيفاً آخر." /> : <View />}
    ListFooterComponent={footer} refreshing={resource.loading && !!resource.data} onRefresh={resource.reload}
    onEndReached={() => { if (!resource.error) resource.more(); }} onEndReachedThreshold={0.4} />;
  const displayControl = <NativeSegmented label="عرض الأماكن" value={display} onChange={setDisplay} options={[{ label: 'قائمة', value: 'list' }, { label: 'خريطة', value: 'map' }]} />;
  const map = <View style={{ flex: 1, padding: 18, gap: 12 }}>
    <Label secondary>خريطة النتائج المحمّلة فقط</Label>
    <MapView pins={pins} onPinPress={id => { const place = items.find(item => String(item.id) === id); if (place) open(place); }} />
    {footer}
  </View>;
  return <AdaptivePanes primary={list(false)} secondary={map} compact={display === 'list' ? list(true) : <ScrollView>
    <View style={contentStyle}>{controls}{displayControl}<RequestStatus resource={resource} /></View><View style={{ minHeight: 420 }}>{map}</View>
  </ScrollView>} />;
}

export function SavedScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const state = useAppState();
  const [search, setSearch] = useState('');
  const places = useMemo(() => state.saved.filter(place => matchesSearch(place.name, search)), [state.saved, search]);
  const pins = useMemo(() => placesPins(places), [places]);
  const open = (place: Place): void => navigation.navigate('Place', { id: place.id, snapshot: place });
  return <AdaptivePanes primary={<FlatList data={places} keyExtractor={item => String(item.id)}
    renderItem={({ item }) => <PlaceCard place={item} open={open} />} contentContainerStyle={contentStyle}
    ItemSeparatorComponent={() => <View style={{ height: 14 }} />} initialNumToRender={5}
    ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}><Heading subtitle="محفوظة على هذا الجهاز ومتاحة دون اتصال">أماكني</Heading>
      <SearchField value={search} onChange={setSearch} placeholder="ابحث في الأماكن المحفوظة" />
      {state.error ? <Section><Label>{state.error}</Label><NativeAction title="إعادة المحاولة" onPress={state.retry} /></Section> : null}
      {!state.ready && !state.error ? <ActivityIndicator accessibilityLabel="جارٍ قراءة الأماكن المحفوظة" /> : null}
    </View>}
    ListEmptyComponent={state.ready ? <EmptyState symbol="bookmark" title={search ? 'لا توجد نتائج' : 'لم تحفظ أي مكان بعد'} detail="افتح مكاناً في مشوار واضغط حفظ على الجهاز." /> : <View />} />}
    secondary={<View style={{ flex: 1, padding: 18, gap: 12 }}><Label secondary>الأماكن المحفوظة على هذا الجهاز</Label><MapView pins={pins} onPinPress={id => {
      const place = places.find(item => String(item.id) === id); if (place) open(place);
    }} /></View>} />;
}

export function PlaceScreen(): React.JSX.Element {
  const { params } = useRoute<RouteProp<RootRoutes, 'Place'>>();
  const load = useCallback((signal: AbortSignal) => api.place(params.id, signal), [params.id]);
  const resource = useResource(load);
  const state = useAppState();
  const { colors } = useTheme();
  const [actionError, setActionError] = useState<string | null>(null);
  const place = resource.data ?? params.snapshot ?? state.saved.find(item => item.id === params.id);
  const saved = state.saved.some(item => item.id === params.id);
  const pins = useMemo(() => place ? placesPins([place]) : [], [place]);
  async function directions(): Promise<void> {
    if (!place) return;
    setActionError(null);
    try { await Linking.openURL(directionsUrl(place.coordinate, place.name)); }
    catch { setActionError('تعذر فتح الخرائط. حاول مرة أخرى.'); }
  }
  async function share(): Promise<void> {
    if (!place) return;
    setActionError(null);
    const url = `https://syrian.zone/mishwar?place=${place.id}`;
    try { await Share.share({ message: `${place.name}\n${url}`, url }); }
    catch { setActionError('تعذرت المشاركة. حاول مرة أخرى.'); }
  }
  const map = <MapView pins={pins} />;
  const details = (inlineMap: boolean): React.JSX.Element => <ScrollView contentContainerStyle={contentStyle}>
    <RequestStatus resource={resource} />
    {place ? <>
      <Heading subtitle={placeCategories.find(item => item.key === place.category)?.label ?? ''}>{place.name}</Heading>
      {!resource.data ? <Label secondary>{saved ? 'نسخة محفوظة على هذا الجهاز. حمّل التفاصيل عند الاتصال.' : resource.error ? 'عرض بيانات القائمة. التفاصيل غير متاحة الآن.' : 'جارٍ تحميل تفاصيل المكان.'}</Label> : null}
      {resource.data?.photos.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
        {resource.data.photos.map(photo => <View key={photo.id} style={{ width: 280 }}><Photo url={photo.url} label={place.name} height={240} /></View>)}
      </ScrollView> : <Photo url={place.thumbnail} label={place.name} height={230} />}
      {place.description ? <Section><Label>{place.description}</Label></Section> : null}
      {resource.data?.contributor ? <Label secondary>{`بمساهمة ${resource.data.contributor}`}</Label> : null}
      <Section><NativeAction title={saved ? 'إزالة من محفوظات الجهاز' : 'حفظ على الجهاز'} systemImage={saved ? 'bookmark.fill' : 'bookmark'}
        disabled={!state.storageAvailable || state.busy} onPress={() => { void state.toggleSaved(place); }} />
        <Label secondary>هذه المحفوظات خاصة بهذا الجهاز.</Label>
        <NativeAction title="الاتجاهات في خرائط Apple" systemImage="arrow.triangle.turn.up.right.diamond" onPress={() => { void directions(); }} />
        <NativeAction title="مشاركة المكان" systemImage="square.and.arrow.up" onPress={() => { void share(); }} />
      </Section>
      {state.error || actionError ? <Section><Label style={{ color: colors.danger }}>{actionError ?? state.error}</Label></Section> : null}
      {inlineMap ? <View style={{ height: 280 }}>{map}</View> : null}
    </> : null}
  </ScrollView>;
  return <AdaptivePanes primary={details(false)} secondary={<View style={{ flex: 1, padding: 18 }}>{map}</View>} compact={details(true)} />;
}
