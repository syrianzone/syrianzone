import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import Svg, { Path } from 'react-native-svg';
import { matchesSearch, routeColor, stopsForRoute, type Coordinate, type EntityId, type TransitStop } from './domain';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from './components';
import { useResource } from './resource';
import { NativeAction, NativeSegmented, NativeSymbol, NativeToggle } from './ui/native';
import { useTheme } from './ui/theme';
import { ProjectIcon } from './ui/graphics';
import { MapView, type MapPin } from './MapView';
import { cameraForCoordinates, directionsUrl } from './map-data';
import { firstLocation } from './location';
import type { RootNavigation, RootRoutes } from './navigation';
import { useFeatureNavigation } from './platform/features';
import { useScreenActive } from './platform/lifecycle';
import { openExternal, shareText } from './platform/links';
import { transitClient } from './features/Transit/api';
import { groupRoutes, routesForStop, type NearbyStop, type NetworkRoute, type Poi, type TransitCity } from './features/Transit/model';

export function TransitScreen(): React.JSX.Element {
  const navigation = useNavigation<RootNavigation>(), features = useFeatureNavigation(), { colors } = useTheme();
  const resource = useResource(useCallback((signal: AbortSignal) => transitClient.cities(signal), []));
  const [query, setQuery] = useState('');
  const cities = resource.data?.filter(city => matchesSearch(`${city.nameAr} ${city.name}`, query)) ?? [];
  return <AdaptivePanes primary={<FlatList data={cities} keyExtractor={city => String(city.id)} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload}
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 12 }}><ProjectIcon name="transit" size={48} /><Heading subtitle="خطوط النقل ومحطاته، مدينة بمدينتها">ترانزيت</Heading><NativeAction title="ترانزيت ستوديو، أضف مساراً" systemImage="pencil.and.outline" onPress={() => features.open('transit_studio')} /><SearchField value={query} onChange={setQuery} placeholder="ابحث عن مدينة" /><RequestStatus resource={resource} /></View>}
    ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title="لا توجد مدن مطابقة" /> : undefined} ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${item.nameAr}، ${item.comingSoon ? 'قريباً' : `${item.routeCount} خط نقل`}`} accessibilityState={{ disabled: item.comingSoon }} disabled={item.comingSoon} onPress={() => navigation.navigate('TransitCity', { city: item })} style={({ pressed }) => ({ opacity: item.comingSoon ? 0.55 : pressed ? 0.65 : 1 })}><Section><View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>{item.icon ? <Svg width={54} height={54} viewBox={item.icon.viewBox}><Path d={item.icon.path} fill={colors.accent} /></Svg> : <NativeSymbol name="mappin" size={44} />}<View style={{ flex: 1 }}><Label style={{ fontWeight: '700', fontSize: 21 }}>{item.nameAr}</Label><Label secondary>{item.comingSoon ? 'قريباً' : `${item.routeCount} خط نقل`}</Label></View></View></Section></Pressable>} />} />;
}

type Entry = { kind: 'heading'; id: string; name: string } | { kind: 'route'; id: string; route: NetworkRoute } | { kind: 'stop'; id: string; stop: TransitStop };
export function TransitCityScreen({ route }: NativeStackScreenProps<RootRoutes, 'TransitCity'>): React.JSX.Element {
  const initialCity = route.params.city;
  const { colors } = useTheme(), navigation = useFeatureNavigation(), active = useScreenActive();
  const cities = useResource(useCallback((signal: AbortSignal) => transitClient.cities(signal), []));
  const city = useMemo<TransitCity>(() => cities.data?.find(item => String(item.id) === String(initialCity.id)) ?? { ...initialCity, status: initialCity.comingSoon ? 'coming_soon' : 'active', zoom: 12, bounds: null, mapGroup: [String(initialCity.id)], mapGroupLabel: null, icon: null }, [cities.data, initialCity]);
  const resource = useResource(useCallback((signal: AbortSignal) => transitClient.network(initialCity.id, signal), [initialCity.id]));
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [view, setView] = useState<'list' | 'map'>(route.params.initialView ?? 'list');
  const [routeId, setRouteId] = useState<string | null>(route.params.routeId ?? null), [stopId, setStopId] = useState<string | null>(null), [showStops, setShowStops] = useState(true);
  const [nearby, setNearby] = useState<NearbyStop[] | null>(null), [position, setPosition] = useState<Coordinate | null>(null), [poi, setPoi] = useState<Poi | null>(null);
  const [locating, setLocating] = useState(false), [locationError, setLocationError] = useState<string | null>(null), [actionError, setActionError] = useState<string | null>(null);
  const [camera, setCamera] = useState<{ coordinates: Coordinate; zoom: number } | null>(null);
  const nearbyController = useRef<AbortController | null>(null);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 300); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { setRouteId(route.params.routeId ?? null); setStopId(null); setNearby(null); setPoi(null); setQuery(''); setCamera(null); nearbyController.current?.abort(); setLocating(false); }, [initialCity.id, route.params.routeId]);
  useEffect(() => { setView(route.params.initialView ?? 'list'); }, [initialCity.id, route.params.initialView]);
  useEffect(() => { if (!active) { nearbyController.current?.abort(); setLocating(false); } }, [active]);
  useEffect(() => () => nearbyController.current?.abort(), []);
  const search = useResource(useCallback((signal: AbortSignal) => transitClient.search(debounced, city.id, signal), [debounced, city.id]), { enabled: debounced.length > 0 });
  const pois = useResource(useCallback((signal: AbortSignal) => transitClient.pois(debounced, city.id, signal), [debounced, city.id]), { enabled: debounced.length >= 3 });
  const selectedRoute = resource.data?.routes.find(item => String(item.id) === routeId) ?? null;
  const selectedStop = [...nearby ?? [], ...resource.data?.stops ?? []].find(item => String(item.id) === stopId) ?? null;
  const selectedStopRoutes = selectedStop ? routesForStop(selectedStop, resource.data?.routes ?? [], String(city.id)) : [];
  const stops = useMemo(() => selectedRoute && resource.data ? stopsForRoute(resource.data, selectedRoute.id) : [], [selectedRoute, resource.data]);
  useEffect(() => { if (selectedRoute) { const fit = cameraForCoordinates(selectedRoute.segments.flat()); if (fit) setCamera(fit); } }, [selectedRoute]);
  const groupList = useMemo(() => groupRoutes(city, resource.data?.routes ?? [], cities.data ?? [city]), [city, resource.data, cities.data]);
  const entries: Entry[] = nearby ? nearby.map(stop => ({ kind: 'stop', id: `near:${stop.id}`, stop })) : selectedRoute ? stops.map(stop => ({ kind: 'stop', id: `stop:${stop.id}`, stop })) : groupList.flatMap(group => [
    ...(city.mapGroup.length > 1 ? [{ kind: 'heading' as const, id: `group:${group.id}`, name: group.name }] : []), ...group.routes.map(item => ({ kind: 'route' as const, id: `route:${item.id}`, route: item }))
  ]);
  function cancelNearby(): void { nearbyController.current?.abort(); setLocating(false); setLocationError(null); }
  function selectRoute(id: EntityId): void { cancelNearby(); setRouteId(String(id)); setStopId(null); setNearby(null); setPoi(null); setQuery(''); }
  function reset(): void { cancelNearby(); setRouteId(null); setStopId(null); setNearby(null); setPoi(null); setCamera(null); }
  function selectStop(stop: TransitStop): void { cancelNearby(); setStopId(String(stop.id)); setPoi(null); setCamera({ coordinates: stop.coordinate, zoom: 16 }); }
  function openRoute(id: EntityId, cityId: string): void { if (city.mapGroup.includes(cityId)) selectRoute(id); else navigation.open('transit', { cityId, routeId: String(id) }); }
  async function locate(withNearby: boolean): Promise<void> {
    cancelNearby(); if (!active) return;
    const controller = new AbortController(); nearbyController.current = controller; setLocating(true);
    try {
      let fix = withNearby ? position : null;
      if (!fix) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (controller.signal.aborted) return;
        if (!permission.granted) { setLocationError('اسمح بالوصول إلى الموقع من إعدادات الجهاز. يمكنك متابعة تصفح المدن.'); return; }
        fix = await firstLocation((onPosition, onError) => Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced }, value => onPosition(value.coords), onError), controller.signal);
      }
      if (controller.signal.aborted) return;
      setPosition(fix); setCamera({ coordinates: fix, zoom: 16 });
      if (withNearby) { const rows = await transitClient.nearby(fix, controller.signal); if (!controller.signal.aborted) { setNearby(rows); setRouteId(null); setStopId(null); setQuery(''); } }
    } catch (error) { if (!controller.signal.aborted) setLocationError(error instanceof Error ? error.message : 'تعذر تحديد الموقع. حاول مرة أخرى.'); }
    finally { if (!controller.signal.aborted) setLocating(false); }
  }
  const pins = useMemo<MapPin[]>(() => [
    ...(showStops ? (nearby ?? (selectedRoute ? stops : resource.data?.stops ?? [])).map(stop => ({ id: `stop:${stop.id}`, name: stop.name, coordinate: stop.coordinate, symbol: 'bus' })) : []),
    ...(position ? [{ id: 'user-location', name: 'موقعي الحالي', coordinate: position, symbol: 'location.fill', color: '#2563EB' }] : []),
    ...(poi ? [{ id: 'selected-poi', name: poi.name, coordinate: poi.coordinate, symbol: 'mappin.circle.fill', color: '#8b5cf6' }] : [])
  ], [showStops, nearby, selectedRoute, stops, resource.data, position, poi]);
  const lines = useMemo(() => (resource.data?.routes ?? []).flatMap(item => item.segments.map((coordinates, index) => ({ id: `${item.id}:${index}`, coordinates, color: routeId && String(item.id) !== routeId ? `${routeColor(item.colorIndex)}33` : routeColor(item.colorIndex) }))), [resource.data, routeId]);
  const act = (action: () => Promise<void>): void => { setActionError(null); void action().catch((error: unknown) => setActionError(error instanceof Error ? error.message : 'تعذر إكمال الإجراء.')); };
  const controls = <View style={{ gap: 12 }}><SearchField value={query} onChange={setQuery} placeholder="ابحث عن خط، موقف، أو مكان" /><NativeSegmented value={view} onChange={setView} options={[{ value: 'list', label: 'القائمة' }, { value: 'map', label: 'الخريطة' }]} /><NativeToggle title="إظهار المواقف" value={showStops} onChange={setShowStops} />
    {city.mapGroup.length > 1 && city.mapGroupLabel ? <Label secondary>تعرض هذه الخريطة خطوط {city.mapGroupLabel}: {city.mapGroup.map(id => cities.data?.find(item => String(item.id) === id)?.nameAr ?? id).join(' و')} معاً.</Label> : null}
    {query.trim() && query.trim() === debounced ? <Section>{search.data?.routes.map(item => <Row key={`search-route:${item.id}`} title={item.name} subtitle="خط نقل" onPress={() => openRoute(item.id, item.cityId)} />)}{search.data?.stops.map(item => <Row key={`search-stop:${item.id}`} title={item.name} subtitle="موقف" onPress={() => { if (item.coordinate) { setRouteId(null); setStopId(String(item.id)); setCamera({ coordinates: item.coordinate, zoom: 16 }); setQuery(''); } }} />)}{pois.data?.map((item, index) => <Row key={`poi:${index}`} title={item.name} subtitle={item.subtitle} onPress={() => { setPoi(item); setStopId(null); setCamera({ coordinates: item.coordinate, zoom: 16 }); setQuery(''); }} />)}<RequestStatus resource={search} />{debounced.length >= 3 ? <RequestStatus resource={pois} /> : null}</Section> : null}
  </View>;
  const details = <View style={{ gap: 12 }}>{selectedRoute || nearby ? <NativeAction title="كل الخطوط" systemImage="arrow.backward" onPress={reset} /> : null}
    {selectedRoute ? <Section><Heading {...(selectedRoute.nameEn ? { subtitle: selectedRoute.nameEn } : {})}>{selectedRoute.name}</Heading><Label secondary>{stops.length} موقف</Label>{selectedRoute.priceNew !== null ? <Label>سعر الركوب: {selectedRoute.priceNew.toLocaleString('ar-SY')} ل.س</Label> : null}{selectedRoute.priceOld !== null ? <Label secondary>بالعملة القديمة: {selectedRoute.priceOld.toLocaleString('ar-SY')} ل.س</Label> : null}<NativeAction title="مشاركة الخط" onPress={() => act(() => shareText(selectedRoute.name, `https://syrian.zone/transit/city/${encodeURIComponent(String(city.id))}?route=${encodeURIComponent(String(selectedRoute.id))}`))} /></Section> : null}
    {nearby ? <Heading subtitle={`${nearby.length} موقف`}>مواقف قريبة منك</Heading> : null}
    {selectedStop ? <Section><Heading>{selectedStop.name}</Heading><NativeAction title="الاتجاهات في خرائط Apple" onPress={() => act(() => openExternal(directionsUrl(selectedStop.coordinate, selectedStop.name)))} /><NativeAction title="الاتجاهات في خرائط جوجل" onPress={() => act(() => openExternal(`https://www.google.com/maps/dir/?api=1&destination=${selectedStop.coordinate.latitude},${selectedStop.coordinate.longitude}`))} />{selectedStopRoutes.map(item => <NativeAction key={String(item.id)} title={item.name} onPress={() => openRoute(item.id, item.cityId)} />)}</Section> : null}
    {poi ? <Section><Heading>{poi.name}</Heading><Label secondary>{poi.subtitle}</Label><NativeAction title="الاتجاهات" onPress={() => act(() => openExternal(directionsUrl(poi.coordinate, poi.name)))} /></Section> : null}
    {locationError || actionError ? <Label style={{ color: colors.danger }}>{locationError ?? actionError}</Label> : null}
    <NativeAction title={locating ? 'جارٍ تحديد الموقع' : position ? 'موقعي الحالي' : 'أظهر موقعي'} systemImage="location" disabled={locating} onPress={() => { void locate(false); }} /><NativeAction title="المواقف القريبة" disabled={locating} onPress={() => { void locate(true); }} /><NativeAction title="إضافة مسار في هذه المدينة" systemImage="plus" onPress={() => navigation.open('transit_studio', { city: String(city.id) })} />
  </View>;
  const list = <FlatList data={entries} keyExtractor={item => item.id} contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" refreshing={resource.loading} onRefresh={resource.reload} ListHeaderComponent={<View style={{ gap: 16 }}>{controls}<RequestStatus resource={resource} />{details}</View>} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} ListEmptyComponent={!resource.loading && !resource.error ? <EmptyState title={nearby ? 'لا توجد مواقف قريبة' : selectedRoute ? 'لا توجد مواقف مسجلة لهذا الخط' : 'لا توجد خطوط متاحة'} /> : undefined}
    renderItem={({ item }) => item.kind === 'heading' ? <Heading>{item.name}</Heading> : item.kind === 'route' ? <Row title={item.route.name} subtitle={`${item.route.stopsCount ?? item.route.stopIds.length} موقف${item.route.priceNew !== null ? ` · ${item.route.priceNew} ل.س` : ''}`} onPress={() => selectRoute(item.route.id)} trailing={<View style={{ width: 12, height: 28, borderRadius: 6, backgroundColor: routeColor(item.route.colorIndex) }} />} /> : <Section><Row title={item.stop.name} symbol="mappin.circle" selected={selectedStop?.id === item.stop.id} onPress={() => selectStop(item.stop)} />{'routes' in item.stop ? (item.stop as NearbyStop).routes.map(row => <NativeAction key={String(row.id)} title={row.name} onPress={() => openRoute(row.id, (item.stop as NearbyStop).cityId)} />) : null}</Section>} />;
  const map = <View style={{ flex: 1, padding: 14, gap: 12 }}><MapView pins={pins} lines={lines} center={city.coordinates} {...(camera ? { camera } : {})} onPinPress={id => { if (id.startsWith('stop:')) { const stop = [...nearby ?? [], ...resource.data?.stops ?? []].find(item => String(item.id) === id.slice(5)); if (stop) selectStop(stop); } }} onLinePress={id => selectRoute(id.slice(0, id.lastIndexOf(':')))} /></View>;
  const compactMap = <ScrollView contentContainerStyle={{ paddingBottom: 24 }}><View style={{ padding: 18, gap: 12 }}>{controls}<RequestStatus resource={resource} />{details}</View><View style={{ height: 440 }}>{map}</View></ScrollView>;
  return <AdaptivePanes primary={list} secondary={map} compact={view === 'list' ? list : compactMap} />;
}
// PORT STATUS: source resources/js/Pages/Transit/Index.tsx,city/[id]/Index.tsx and _components; confidence medium; todos 1 native route/search/location/nearby verification.
