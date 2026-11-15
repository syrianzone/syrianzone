import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { matchesSearch, type Place } from './domain';
import { AdaptivePanes, EmptyState, Heading, Label, Photo, Row, Section, SearchField, contentStyle } from './components';
import { MapView, type MapPin } from './MapView';
import type { RootNavigation, RootRoutes, TabRoutes } from './navigation';
import { useAppState } from './state';
import { NativeAction } from './ui/native';
import { DiscoveryScreen, type DiscoverySlots } from './features/Places/Index';
import { PlaceDetailScreen } from './features/Places/Detail';
import { HotelsScreen } from './features/Hotels/Index';
import { GuidesScreen } from './features/Guides/Index';

const renderGuides: DiscoverySlots['renderGuides'] = props => <GuidesScreen {...props} />;
const renderHotels: DiscoverySlots['renderHotels'] = props => <HotelsScreen {...props} />;

export function PlacesScreen(): React.JSX.Element {
  const route = useRoute<RouteProp<TabRoutes, 'Places'>>();
  return <DiscoveryScreen params={route.params ?? {}} renderGuides={renderGuides} renderHotels={renderHotels} />;
}
export function PlaceScreen(): React.JSX.Element {
  const { params } = useRoute<RouteProp<RootRoutes, 'Place'>>();
  return <PlaceDetailScreen id={params.id} {...(params.snapshot ? { snapshot: params.snapshot } : {})} />;
}
function placesPins(places: readonly Place[]): MapPin[] { return places.map(place => ({ id: String(place.id), name: place.name, coordinate: place.coordinate })); }

// PORT NOTE: Device snapshots remain an explicit native addition, separate from the website's account-synchronized saves.
export function SavedScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>(), state = useAppState();
  const [search, setSearch] = useState('');
  const places = useMemo(() => state.saved.filter(place => matchesSearch(place.name, search)), [state.saved, search]);
  const pins = useMemo(() => placesPins(places), [places]);
  const open = (place: Place): void => navigation.navigate('Place', { id: place.id, snapshot: place });
  return <AdaptivePanes primary={<FlatList data={places} keyExtractor={item => String(item.id)}
    renderItem={({ item }) => <Section style={{ padding: 8, gap: 0 }}><Photo url={item.thumbnail} label={item.name} height={170} /><Row title={item.name} onPress={() => open(item)} /></Section>} contentContainerStyle={contentStyle}
    ItemSeparatorComponent={() => <View style={{ height: 14 }} />} initialNumToRender={5}
    ListHeaderComponent={<View style={{ gap: 16, paddingBottom: 16 }}><Heading subtitle="محفوظة على هذا الجهاز ومتاحة دون اتصال">أماكني</Heading>
      <SearchField value={search} onChange={setSearch} placeholder="ابحث في الأماكن المحفوظة" />
      {state.error ? <Section><Label>{state.error}</Label><NativeAction title="إعادة المحاولة" onPress={state.retry} /></Section> : null}
      {!state.ready && !state.error ? <ActivityIndicator accessibilityLabel="جارٍ قراءة الأماكن المحفوظة" /> : null}
    </View>}
    ListEmptyComponent={state.ready ? <EmptyState symbol="bookmark" title={search ? 'لا توجد نتائج' : 'لم تحفظ أي مكان بعد'} detail="افتح مكاناً في مشوار واضغط حفظ على الجهاز." /> : undefined} />}
    secondary={<View style={{ flex: 1, padding: 18, gap: 12 }}><Label secondary>الأماكن المحفوظة على هذا الجهاز</Label><MapView pins={pins} onPinPress={id => {
      const place = places.find(item => String(item.id) === id); if (place) open(place);
    }} /></View>} />;
}
// PORT STATUS: source resources/js/Pages/Places/Index.tsx and native device-local saved-place baseline; confidence medium; todos 1 native discovery/detail regression verification.
