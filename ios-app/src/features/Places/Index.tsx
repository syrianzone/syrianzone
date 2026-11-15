import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { FlatList, ScrollView, View, useWindowDimensions } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, Photo, RequestStatus, Row, SearchField, Section } from '../../components';
import { placeCategories, type Coordinate, type Place } from '../../domain';
import type { MapCameraChange, MapPin } from '../../MapView';
import { useResource } from '../../resource';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { NativeAction, NativePicker, NativeSegmented, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { decodeHotelPins } from '../../platform/hotel-map';
import { placesClient } from './api';
import { CommunityPlaces } from './Community';
import { inSyria, parseCoordinates, type GeoSuggestion } from './model';
import { PhotoViewer } from './PhotoViewer';
import { ContributionSheet } from './Submit';
import { usePages } from './usePages';
import { ClusteredPlacesMap } from './ClusteredMap';

type Tab = 'places' | 'hotels' | 'saves' | 'mine' | 'guides';
type Display = 'list' | 'map' | 'photos';
type PinFilter = 'all' | 'places' | 'hotels';
const tabs = [{ value: 'places', label: 'الأماكن' }, { value: 'hotels', label: 'الفنادق' }, { value: 'saves', label: 'محفوظات الحساب' }, { value: 'mine', label: 'مساهماتي' }, { value: 'guides', label: 'مرشدون' }] as const;
const initialGuide = (params: Readonly<Record<string, string>>): { id: number; name: string } | null => /^\d{1,10}$/.test(params.guideId ?? params.guide ?? '') && Number(params.guideId ?? params.guide) > 0 ? { id: Number(params.guideId ?? params.guide), name: params.guideName ?? 'مرشد' } : null;
export interface DiscoverySlots {
  renderGuides(props: { header: ReactNode; onSelectGuide(guide: { id: number; name: string }): void }): ReactElement;
  renderHotels(props: { header: ReactNode }): ReactElement;
}
export function DiscoveryScreen({ params, renderGuides, renderHotels }: FeatureScreenProps & DiscoverySlots): React.JSX.Element {
  const navigation = useFeatureNavigation(), account = useAccount(), { colors } = useTheme(), { width, fontScale } = useWindowDimensions();
  const [query, setQuery] = useState(params.q ?? ''), [debounced, setDebounced] = useState(''), [category, setCategory] = useState('');
  const [sort, setSort] = useState<'newest' | 'popular'>('newest'), [pinFilter, setPinFilter] = useState<PinFilter>('all');
  const [display, setDisplay] = useState<Display>(params.view === 'photos' || params.view === 'grid' ? 'photos' : params.view === 'list' ? 'list' : 'map');
  const [tab, setTab] = useState<Tab>(tabs.some(item => item.value === params.tab) ? params.tab as Tab : 'places');
  const [guide, setGuide] = useState(() => initialGuide(params)), [highlight, setHighlight] = useState<GeoSuggestion | null>(null);
  const [addMode, setAddMode] = useState(false), [submitPoint, setSubmitPoint] = useState<Coordinate | null>(null), [notice, setNotice] = useState<string | null>(null), [viewer, setViewer] = useState<number | null>(null);
  const [camera, setCamera] = useState({ coordinates: { latitude: 34.75, longitude: 39 }, zoom: 6 });
  const viewport = useRef<MapCameraChange | null>(null);
  const guideQueryId = params.guideId ?? params.guide ?? '', guideQueryName = params.guideName ?? 'مرشد';
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { const next = initialGuide({ guideId: guideQueryId, guideName: guideQueryName }); setGuide(previous => previous?.id === next?.id && previous?.name === next?.name ? previous : next); }, [guideQueryId, guideQueryName]);
  useEffect(() => { if (tabs.some(item => item.value === params.tab)) setTab(params.tab as Tab); }, [params.tab]);
  useEffect(() => { if (params.view === 'photos' || params.view === 'grid') setDisplay('photos'); else if (params.view === 'map' || params.view === 'list') setDisplay(params.view); }, [params.view]);
  useEffect(() => { if (/^\d{1,10}$/.test(params.placeId ?? '') && Number(params.placeId) > 0) navigation.open('place', { id: params.placeId! }); }, [params.placeId, navigation]);
  useEffect(() => { if (!highlight) return; const timer = setTimeout(() => setHighlight(null), 6000); return () => clearTimeout(timer); }, [highlight]);
  const pins = useResource(useCallback((signal: AbortSignal) => placesClient.pins(signal), []));
  const hotels = useResource(useCallback((signal: AbortSignal) => api.request('hotels/map', decodeHotelPins, { signal }), []));
  const coordinate = parseCoordinates(query), coordinateSearch = useMemo(() => parseCoordinates(debounced), [debounced]);
  const listing = usePages(useCallback((page: number, signal: AbortSignal) => placesClient.list({ page, sort, ...(category ? { category } : {}), ...(!coordinateSearch && debounced ? { q: debounced.slice(0, 100) } : {}), ...(guide ? { user_id: guide.id } : {}) }, signal), [sort, category, coordinateSearch, debounced, guide]));
  const geocoder = useResource(useCallback((signal: AbortSignal) => placesClient.geocode(debounced, signal), [debounced]), { enabled: debounced.length >= 2 && coordinateSearch === null });
  const photos = usePages(useCallback((page: number, signal: AbortSignal) => placesClient.photos(page, signal, guide?.id), [guide?.id]), display === 'photos' && tab === 'places', true);
  const mapPins = useMemo<MapPin[]>(() => [
    ...(pinFilter !== 'hotels' ? (pins.data ?? []).filter(item => (!category || item.category === category) && (!guide || item.userId === guide.id)).map(item => ({ id: `place:${item.id}`, name: item.name, coordinate: item.coordinate, color: '#7d8a5c' })) : []),
    ...(pinFilter !== 'places' ? (hotels.data ?? []).map(item => ({ id: `hotel:${item.id}`, name: item.name, coordinate: item.coordinate, symbol: 'bed.double', color: '#c05621' })) : []),
    ...(highlight ? [{ id: 'coordinate-highlight', name: highlight.name, coordinate: highlight.coordinate, symbol: 'scope', color: '#7d8a5c' }] : [])
  ], [pins.data, hotels.data, pinFilter, category, guide, highlight]);
  const viewerPhotos = useMemo(() => photos.data?.items.map(photo => ({ id: photo.id, url: photo.url, name: photo.place.name, placeId: photo.place.id })) ?? [], [photos.data]);
  const focus = (suggestion: GeoSuggestion): void => { setCamera({ coordinates: suggestion.coordinate, zoom: 16 }); setHighlight(suggestion); setDisplay('map'); };
  const openPlace = (place: Place): void => navigation.open('place', { id: String(place.id) });
  const selectGuide = (selected: { id: number; name: string }): void => { setGuide(selected); setTab('places'); setDisplay('map'); setQuery(''); };
  const chooseLocation = (): void => { const point = viewport.current?.center ?? camera.coordinates; if (!inSyria(point)) { setNotice('النقطة خارج حدود سوريا.'); return; } setSubmitPoint(point); setAddMode(false); setNotice(null); };
  const selectPin = (id: string): void => { if (id.startsWith('place:')) { setAddMode(false); navigation.open('place', { id: id.slice(6) }); } else if (id.startsWith('hotel:')) { setAddMode(false); navigation.open('hotel', { id: id.slice(6) }); } };
  const controls = <View style={{ gap: 12, marginBottom: 12 }}><ProjectIcon name="mishwar" size={46} /><Heading subtitle="أماكن تستحق المشوار في سوريا">مشوار</Heading>
    <NativeAction title={addMode ? 'إلغاء الإضافة' : 'أضف مكاناً'} prominent={!addMode} destructive={addMode} onPress={() => { setAddMode(value => !value); setDisplay('map'); setTab('places'); }} />
    <NativePicker<Tab> label="قائمة مشوار" value={tab} options={tabs.filter(item => account.user || item.value !== 'saves' && item.value !== 'mine')} onChange={setTab} />
    {guide ? <Section><Label>مساهمات {guide.name}</Label><NativeAction title="عرض كل المساهمين" onPress={() => setGuide(null)} /></Section> : null}
    {tab === 'places' ? <><SearchField value={query} onChange={setQuery} placeholder="ابحث عن مكان أو إحداثيات" /><NativePicker label="التصنيف" value={category} onChange={setCategory} options={[{ value: '', label: 'كل التصنيفات' }, ...placeCategories.map(item => ({ value: item.key, label: item.label }))]} /><NativeSegmented<Display> label="عرض مشوار" value={display} onChange={setDisplay} options={[{ value: 'map', label: 'الخريطة' }, { value: 'list', label: 'القائمة' }, { value: 'photos', label: 'الصور' }]} />
      {coordinate ? <NativeAction title={`الانتقال إلى ${coordinate.latitude}, ${coordinate.longitude}`} onPress={() => focus({ coordinate, name: 'الإحداثيات المختارة', address: '' })} /> : null}
      {query.trim() && !coordinate && query.trim() === debounced ? <Section>{listing.data?.items.slice(0, 8).map(place => <Row key={`search:${place.id}`} title={place.name} onPress={() => openPlace(place)} />)}{geocoder.data?.map((suggestion, index) => <Row key={`geo:${index}`} title={suggestion.name} subtitle={suggestion.address} onPress={() => focus(suggestion)} />)}{geocoder.error ? <Label secondary>تعذر تحميل اقتراحات المواقع. يمكنك متابعة البحث في الأماكن.</Label> : null}</Section> : null}
      {display === 'list' ? <NativeSegmented<'newest' | 'popular'> label="ترتيب الأماكن" value={sort} onChange={setSort} options={[{ value: 'newest', label: 'الأحدث' }, { value: 'popular', label: 'الأكثر حفظاً' }]} /> : null}
    </> : null}{notice ? <Label style={{ color: colors.danger }}>{notice}</Label> : null}
  </View>;
  const map = <View style={{ flex: 1, minHeight: 380, gap: 10 }}><NativeSegmented<PinFilter> label="نقاط الخريطة" value={pinFilter} onChange={setPinFilter} options={[{ value: 'all', label: 'الكل' }, { value: 'places', label: 'الأماكن' }, { value: 'hotels', label: 'الفنادق' }]} /><RequestStatus resource={pins} /><RequestStatus resource={hotels} />
    <View style={{ flex: 1, minHeight: 320 }}><ClusteredPlacesMap pins={mapPins} camera={camera} focus={setCamera} onPinPress={selectPin} onCameraChange={value => { viewport.current = value; }} onMapPress={point => { if (addMode) { const zoom = viewport.current?.zoom ?? camera.zoom; viewport.current = null; setCamera({ coordinates: point, zoom }); } else setHighlight(null); }} />{addMode ? <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -16 }, { translateY: -16 }] }}><NativeSymbol name="plus.circle.fill" size={32} /></View> : null}</View>
    {addMode ? <Section><Label>حرّك الخريطة وضع علامة المركز فوق المكان، ثم أكّد الموقع.</Label><NativeAction title="استخدام هذا الموقع" onPress={chooseLocation} /></Section> : null}
  </View>;
  const photoColumns = fontScale >= 1.8 ? 1 : width >= 900 ? 4 : 2;
  const primary = tab === 'guides' ? renderGuides({ header: controls, onSelectGuide: selectGuide }) : tab === 'hotels' ? renderHotels({ header: controls }) : tab === 'saves' || tab === 'mine' ? <CommunityPlaces kind={tab} header={controls} /> : display === 'photos' ? <FlatList key={photoColumns} data={photos.data?.items ?? []} numColumns={photoColumns} keyExtractor={photo => String(photo.id)} contentContainerStyle={contentStyle} columnWrapperStyle={photoColumns > 1 ? { gap: 10 } : undefined} ItemSeparatorComponent={() => <View style={{ height: 10 }} />} ListHeaderComponent={<>{controls}<RequestStatus resource={photos} /></>} ListEmptyComponent={!photos.loading && !photos.error ? <EmptyState title="لا توجد صور" /> : undefined} ListFooterComponent={photos.data && photos.data.currentPage < photos.data.lastPage ? <NativeAction title="عرض المزيد" disabled={photos.loadingMore} onPress={photos.more} /> : undefined} renderItem={({ item, index }) => <View style={{ flex: 1, gap: 6 }}><Photo url={item.thumbnail} label={item.place.name} height={170} /><NativeAction title={item.place.name} onPress={() => setViewer(index)} /></View>} /> : <FlatList data={listing.data?.items ?? []} keyExtractor={place => String(place.id)} contentContainerStyle={contentStyle} ItemSeparatorComponent={() => <View style={{ height: 12 }} />} ListHeaderComponent={<>{controls}<RequestStatus resource={listing} /></>} ListEmptyComponent={!listing.loading && !listing.error ? <EmptyState title="لا توجد أماكن مطابقة" /> : undefined} ListFooterComponent={listing.data && listing.data.currentPage < listing.data.lastPage ? <NativeAction title="تحميل المزيد" disabled={listing.loadingMore} onPress={listing.more} /> : undefined} renderItem={({ item }) => <Section><Photo url={item.thumbnail} label={item.name} height={180} /><Row title={item.name} subtitle={`${placeCategories.find(row => row.key === item.category)?.label ?? item.category} · ${item.savesCount} حفظ`} onPress={() => openPlace(item)} /></Section>} />;
  const compact = display === 'map' && tab === 'places' ? <ScrollView contentContainerStyle={contentStyle}>{controls}<View style={{ height: addMode ? 620 : 460 }}>{map}</View></ScrollView> : primary;
  return <><AdaptivePanes primary={primary} secondary={<View style={{ flex: 1, padding: 18 }}>{map}</View>} compact={compact} /><PhotoViewer photos={viewerPhotos} initialIndex={viewer} close={() => setViewer(null)} showPlace={id => navigation.open('place', { id: String(id) })} /><ContributionSheet point={submitPoint} close={() => setSubmitPoint(null)} submitted={() => { setNotice('تم إرسال المكان وسيظهر بعد الموافقة.'); listing.reload(); }} selectExisting={id => navigation.open('place', { id: String(id) })} /></>;
}
// PORT STATUS: source resources/js/Pages/Places/Index.tsx,FilterBar.tsx,PhotoGrid.tsx,PlacesPanel.tsx; confidence medium; todos 2 native discovery and map clustering verification.
