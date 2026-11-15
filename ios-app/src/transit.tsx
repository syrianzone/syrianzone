import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { api, ApiError } from './api';
import { matchesSearch, routeColor, stopsForRoute, type City, type EntityId, type TransitRoute, type TransitStop } from './domain';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from './components';
import { useResource } from './resource';
import { NativeAction, NativeSegmented } from './ui/native';
import { useTheme } from './ui/theme';
import { MapView } from './MapView';
import { directionsUrl } from './map-data';
import { firstLocation } from './location';
import type { RootNavigation, RootRoutes } from './navigation';

export function TransitScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>();
  const resource = useResource(useCallback(signal => api.cities(signal), []));
  const [query, setQuery] = useState('');
  const cities = resource.data?.filter(city => matchesSearch(city.nameAr, query)) ?? [];
  return <AdaptivePanes primary={<FlatList data={cities} keyExtractor={city => String(city.id)} contentContainerStyle={contentStyle}
    keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="خطوط النقل ومحطاته، مدينة بمدينتها">ترانزيت</Heading><SearchField value={query} onChange={setQuery} placeholder="ابحث عن مدينة" /><RequestStatus resource={resource} /></View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد مدن مطابقة" /> : undefined}
    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    renderItem={({ item }) => <CityRow city={item} onPress={() => { if (!item.comingSoon) navigation.navigate('TransitCity', { city: item }); }} />} />} />;
}

function CityRow({ city, onPress }: { city: City; onPress(): void }): React.JSX.Element {
  return <Row title={city.nameAr} subtitle={city.comingSoon ? 'قريباً' : `${city.routeCount} خط نقل`} symbol="bus.fill" onPress={onPress} />;
}

type ListEntry = { type: 'route'; value: TransitRoute } | { type: 'stop'; value: TransitStop };

export function TransitCityScreen({ route }: NativeStackScreenProps<RootRoutes, 'TransitCity'>): React.JSX.Element {
  const { city } = route.params;
  const { colors } = useTheme();
  const resource = useResource(useCallback(signal => api.transitMap(city.id, signal), [city.id]));
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [routeId, setRouteId] = useState<EntityId | null>(null);
  const [stopId, setStopId] = useState<EntityId | null>(null);
  const [nearby, setNearby] = useState<TransitStop[] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const nearbyController = useRef<AbortController | null>(null);
  useEffect(() => () => nearbyController.current?.abort(), []);
  const selectedRoute = resource.data?.routes.find(item => item.id === routeId) ?? null;
  const selectedStop = (nearby ?? resource.data?.stops ?? []).find(item => item.id === stopId) ?? null;

  async function findNearby(): Promise<void> {
    nearbyController.current?.abort();
    const controller = new AbortController();
    nearbyController.current = controller;
    setLocating(true);
    setLocationError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (controller.signal.aborted) return;
      if (!permission.granted) {
        setLocationError('اسمح بالوصول إلى الموقع من الإعدادات لعرض المحطات القريبة. يمكنك متابعة تصفح المدن.');
        return;
      }
      const location = await firstLocation((onPosition, onError) => Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced }, position => onPosition(position.coords), onError,
      ), controller.signal);
      if (controller.signal.aborted) return;
      const stops = await api.nearbyStops(location, controller.signal);
      if (!controller.signal.aborted) { setNearby(stops); setRouteId(null); setStopId(null); setQuery(''); }
    } catch (error) {
      if (!controller.signal.aborted) setLocationError(error instanceof ApiError ? error.message : 'تعذر تحديد الموقع. حاول مرة أخرى.');
    } finally { if (!controller.signal.aborted) setLocating(false); }
  }

  const routes = useMemo(() => resource.data?.routes.filter(item => matchesSearch(item.name, query)) ?? [], [resource.data, query]);
  const stops = useMemo(() => nearby ?? (selectedRoute && resource.data ? stopsForRoute(resource.data, selectedRoute.id) : []), [nearby, selectedRoute, resource.data]);
  const entries: ListEntry[] = nearby || selectedRoute
    ? stops.map(value => ({ type: 'stop', value }))
    : [...routes.map(value => ({ type: 'route' as const, value })), ...(query ? resource.data?.stops.filter(stop => matchesSearch(stop.name, query)).map(value => ({ type: 'stop' as const, value })) ?? [] : [])];
  const pins = useMemo(() => (nearby ?? (selectedRoute ? stops : resource.data?.stops ?? [])).map(stop => ({ id: String(stop.id), name: stop.name, coordinate: stop.coordinate, symbol: 'bus' })), [nearby, selectedRoute, stops, resource.data]);
  const lines = useMemo(() => (nearby ? [] : selectedRoute ? [selectedRoute] : routes).flatMap(item => item.segments.map((coordinates, index) => ({
    id: `${item.id}:${index}`, coordinates, color: routeColor(item.colorIndex),
  }))), [nearby, selectedRoute, routes]);
  function cancelNearby(): void { nearbyController.current?.abort(); setLocating(false); setLocationError(null); }
  function selectRoute(value: TransitRoute): void { cancelNearby(); setRouteId(value.id); setStopId(null); setNearby(null); }
  function reset(): void { cancelNearby(); setRouteId(null); setStopId(null); setNearby(null); }

  const controls = <View style={{ gap: 12 }}>
    <SearchField value={query} onChange={value => { setQuery(value); reset(); }} placeholder="ابحث عن خط أو محطة" />
    <NativeSegmented value={view} onChange={setView} options={[{ value: 'list', label: 'القائمة' }, { value: 'map', label: 'الخريطة' }]} />
  </View>;
  const details = <View style={{ gap: 12 }}>
    {selectedRoute || nearby ? <NativeAction title="كل الخطوط" systemImage="arrow.backward" onPress={reset} /> : null}
    {selectedRoute ? <Section><Heading>{selectedRoute.name}</Heading><Label secondary>{stops.length} محطة</Label>
      {selectedRoute.priceNew !== null ? <Label>الأجرة: {selectedRoute.priceNew} ليرة سورية جديدة</Label> : null}
      {selectedRoute.priceOld !== null ? <Label secondary>بالعملة القديمة: {selectedRoute.priceOld} ليرة سورية</Label> : null}
    </Section> : null}
    {nearby ? <Heading subtitle={`${nearby.length} محطة`}>المحطات القريبة</Heading> : null}
    {selectedStop ? <Section><Label style={{ fontWeight: '700' }}>{selectedStop.name}</Label>
      <NativeAction title="الاتجاهات" systemImage="arrow.triangle.turn.up.right.diamond" onPress={() => {
        void Linking.openURL(directionsUrl(selectedStop.coordinate, selectedStop.name)).catch(() => setLocationError('تعذر فتح الخرائط.'));
      }} />
    </Section> : null}
    {locationError ? <Label style={{ color: colors.danger }}>{locationError}</Label> : null}
    <NativeAction title={locating ? 'جارٍ تحديد الموقع' : 'محطات بالقرب مني'} systemImage="location" disabled={locating} onPress={() => { void findNearby(); }} />
  </View>;
  const list = <FlatList data={entries} keyExtractor={item => `${item.type}:${item.value.id}`} contentContainerStyle={contentStyle}
    keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload}
    ListHeaderComponent={<View style={{ gap: 16 }}>{controls}<RequestStatus resource={resource} />{details}</View>}
    ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد نتائج" detail="جرّب اسماً آخر أو اختر مدينة أخرى." /> : undefined}
    renderItem={({ item }) => item.type === 'route'
      ? <Row title={item.value.name} subtitle={`${item.value.stopIds.length} محطة`} onPress={() => selectRoute(item.value as TransitRoute)} trailing={<View style={{ width: 12, height: 28, borderRadius: 6, backgroundColor: routeColor(item.value.colorIndex) }} />} />
      : <Row title={item.value.name} symbol="mappin.circle" selected={selectedStop?.id === item.value.id} onPress={() => { cancelNearby(); setStopId(item.value.id); }} />} />;
  const map = <View style={{ flex: 1, padding: 14, gap: 12 }}><MapView pins={pins} lines={lines} center={city.coordinates}
    onPinPress={id => { cancelNearby(); setStopId((nearby ?? resource.data?.stops ?? []).find(stop => String(stop.id) === id)?.id ?? null); }}
    onLinePress={id => { const value = resource.data?.routes.find(item => String(item.id) === id.slice(0, id.lastIndexOf(':'))); if (value) selectRoute(value); }} />
    {selectedStop ? <Label>{selectedStop.name}</Label> : null}
  </View>;
  const compactMap = <ScrollView contentContainerStyle={{ paddingBottom: 24 }}><View style={{ padding: 18, gap: 12 }}>{controls}<RequestStatus resource={resource} />{details}</View><View style={{ height: 360 }}>{map}</View></ScrollView>;
  return <AdaptivePanes primary={list} secondary={map} compact={view === 'list' ? list : compactMap} />;
}
