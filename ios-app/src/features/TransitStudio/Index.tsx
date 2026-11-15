import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { randomUUID } from 'expo-crypto';
import facts from '../../../../resources/data/transit.json';
import { api, ApiError } from '../../api';
import { AdaptivePanes, contentStyle, FormField, Heading, Label, RequestStatus, Row, Section } from '../../components';
import { routeColor, type Coordinate } from '../../domain';
import { MapView, type MapCameraChange } from '../../MapView';
import { cameraForCoordinates } from '../../map-data';
import { useResource } from '../../resource';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { useScreenActive } from '../../platform/lifecycle';
import { readDocument, writeDocument } from '../../platform/storage';
import { NativeAction, NativeIconAction, NativePicker, NativeSymbol, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { ProjectIcon } from '../../ui/graphics';
import { transitClient } from '../../platform/transit-client';
import { entityId } from '../../platform/transit-model';
import { parseCoordinates } from '../../platform/geo';
import { studioClient } from './api';
import { buildPayload, emptyDraft, nearestOnRoute, overlapsRoute, replaceVertex, restoreGeometry, studioCities, withSegments, type GeometrySnapshot, type StudioDraft } from './model';
import { canRestorePending, decodePending, memoryDrafts, pendingKey, type PendingStudio } from './pending';

type Tool = 'idle' | 'append' | 'insert' | 'stop' | 'move-vertex' | 'move-stop';
const tools = [{ value: 'idle', label: 'تصفح الخريطة' }, { value: 'append', label: 'رسم أو إكمال المسار' }, { value: 'insert', label: 'إدراج نقطة على المسار' }, { value: 'stop', label: 'إضافة موقف' }, { value: 'move-vertex', label: 'نقل النقطة المختارة' }, { value: 'move-stop', label: 'نقل الموقف المختار' }] as const;
export function TransitStudioScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const account = useAccount(), navigation = useFeatureNavigation(), active = useScreenActive(), { colors } = useTheme();
  const edit = params.edit ?? '', requestedCity = params.city ?? '', target = edit ? `edit:${edit}` : `new:${requestedCity}`;
  const owner = account.user?.id ?? null, session = account.sessionGeneration, documentKey = `${owner ?? 'guest'}:${target}`;
  const cities = useResource(useCallback((signal: AbortSignal) => transitClient.cities(signal), []));
  const choices = useMemo(() => studioCities(cities.data ?? [], account.user?.effective_permissions ?? [], account.user?.transit_scope ?? null), [cities.data, account.user]);
  const choiceKey = choices.map(city => String(city.id)).join('|');
  const [draft, setDraft] = useState<StudioDraft>(() => memoryDrafts.get(documentKey) ?? emptyDraft(requestedCity)), draftRef = useRef(draft);
  const [loadedKey, setLoadedKey] = useState<string | null>(null), [initializing, setInitializing] = useState(true), [revision, setRevision] = useState(0);
  const [history, setHistory] = useState<GeometrySnapshot[]>([]), [tool, setTool] = useState<Tool>('idle'), [segment, setSegment] = useState(0);
  const [vertex, setVertex] = useState<{ segment: number; index: number } | null>(null), [stopId, setStopId] = useState<string | null>(null), [panel, setPanel] = useState<'vertices' | 'stops' | null>(null);
  const [stopName, setStopName] = useState(''), [stopCoordinates, setStopCoordinates] = useState(''), [showReference, setShowReference] = useState(true);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [submitted, setSubmitted] = useState<{ id: number; anonymous: boolean; linked: boolean } | null>(null);
  const [camera, setCamera] = useState<{ coordinates: Coordinate; zoom: number }>({ coordinates: { latitude: 34.75, longitude: 39 }, zoom: 6 });
  const viewport = useRef<MapCameraChange | null>(null), working = useRef(false);
  const current = loadedKey === documentKey && !initializing && !account.busy;
  const selectedCity = choices.find(city => String(city.id) === draft.cityId);
  const reference = useResource(useCallback((signal: AbortSignal) => transitClient.network(draft.cityId, signal), [draft.cityId]), { enabled: current && Boolean(draft.cityId) });
  const assign = useCallback((next: StudioDraft, key: string) => { draftRef.current = next; setDraft(next); memoryDrafts.set(key, next); }, []);
  useEffect(() => {
    if (!active || !account.ready || account.busy || !cities.data) return;
    const controller = new AbortController(), originSession = session;
    setInitializing(true); setError(null); setSubmitted(null);
    void (async () => {
      try {
        let next = memoryDrafts.get(documentKey) ?? null;
        const pending = await readDocument<PendingStudio | null>(pendingKey, decodePending, null);
        if (controller.signal.aborted) return;
        if (pending && canRestorePending(pending, target, owner)) { next = pending.draft; await writeDocument(pendingKey, null); }
        if (!next && edit) {
          entityId(edit);
          if (!account.user) { setNotice('سجّل الدخول لتحميل المسار للتعديل.'); next = emptyDraft(requestedCity); }
          else next = await studioClient.load(edit, originSession, controller.signal, params.editKind === 'route' ? 'route' : params.editKind === 'draft' ? 'draft' : 'auto');
        }
        if (!next) next = emptyDraft(choices.some(city => String(city.id) === requestedCity) ? requestedCity : String(choices[0]?.id ?? ''));
        if (controller.signal.aborted || api.getSessionGeneration() !== originSession) return;
        assign(next, documentKey); setHistory([]); setVertex(null); setStopId(null); setTool('idle'); setLoadedKey(documentKey);
        const city = choices.find(item => String(item.id) === next.cityId), fit = cameraForCoordinates(next.segments.flat());
        if (fit) setCamera(fit); else if (city?.coordinates) setCamera({ coordinates: city.coordinates, zoom: city.zoom });
        if (next.cityId && !city) setNotice('مدينة هذه المسودة غير متاحة ضمن نطاق حسابك. راجع صلاحياتك قبل الحفظ.');
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر قراءة المسودة.'); }
      finally { if (!controller.signal.aborted) setInitializing(false); }
    })();
    return () => controller.abort();
    // Scope changes are represented by choiceKey; unrelated account settings must not reload a drawing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, account.ready, account.busy, session, owner, documentKey, target, edit, requestedCity, params.editKind, cities.data, choiceKey, revision, assign]);
  function apply(update: (previous: StudioDraft) => StudioDraft, geometry = false): void {
    if (!current || busy || api.getSessionGeneration() !== session) return;
    const previous = draftRef.current, next = update(previous);
    if (geometry) setHistory(values => [...values.slice(-49), { segments: previous.segments, stops: previous.stops }]);
    assign(next, documentKey); setSubmitted(null); setError(null);
  }
  function pointInCity(coordinate: Coordinate): boolean {
    const bounds = selectedCity?.bounds;
    return !bounds || coordinate.latitude >= bounds[0].latitude && coordinate.latitude <= bounds[1].latitude && coordinate.longitude >= bounds[0].longitude && coordinate.longitude <= bounds[1].longitude;
  }
  function mapPoint(coordinate: Coordinate): void {
    if (!current || busy || tool === 'idle') return;
    if (!selectedCity || !pointInCity(coordinate)) { setError('اختر نقطة ضمن حدود المدينة المختارة.'); return; }
    try {
      if (tool === 'append') apply(previous => { const segments = previous.segments.length ? previous.segments.map(line => [...line]) : [[]]; const index = Math.min(segment, segments.length - 1); segments[index] = [...segments[index]!, coordinate]; return withSegments(previous, segments); }, true);
      else if (tool === 'insert') apply(previous => { if (!previous.segments.some(line => line.length > 1)) throw new Error('ارسم المسار أولاً.'); const nearest = nearestOnRoute(previous.segments, coordinate); return withSegments(previous, previous.segments.map((line, index) => index === nearest.segment ? [...line.slice(0, nearest.insertIndex), nearest.coordinate, ...line.slice(nearest.insertIndex)] : line)); }, true);
      else if (tool === 'stop') { const id = randomUUID(); apply(previous => ({ ...previous, stops: [...previous.stops, { id, name: '', coordinate: nearestOnRoute(previous.segments, coordinate).coordinate }] }), true); setStopId(id); setStopName(''); setStopCoordinates(`${coordinate.latitude}, ${coordinate.longitude}`); setPanel('stops'); }
      else if (tool === 'move-vertex') { if (!vertex) throw new Error('اختر نقطة من قائمة نقاط المسار أولاً.'); apply(previous => replaceVertex(previous, vertex.segment, vertex.index, coordinate), true); }
      else { if (!stopId) throw new Error('اختر موقفاً من قائمة المواقف أولاً.'); apply(previous => ({ ...previous, stops: previous.stops.map(stop => stop.id === stopId ? { ...stop, coordinate: nearestOnRoute(previous.segments, coordinate).coordinate } : stop) }), true); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تعديل الرسم.'); }
  }
  const undo = (): void => { if (!current || !history.length || busy || api.getSessionGeneration() !== session) return; const previous = history[history.length - 1]!; assign(restoreGeometry(draftRef.current, previous), documentKey); setHistory(values => values.slice(0, -1)); setVertex(null); setStopId(null); setSubmitted(null); };
  const reset = (cityId = draft.cityId): void => { if (!current || api.getSessionGeneration() !== session) return; assign(emptyDraft(cityId), documentKey); setHistory([]); setSubmitted(null); setVertex(null); setStopId(null); setTool('idle'); setError(null); };
  const askReset = (): void => Alert.alert('بدء رسم جديد؟', 'سيتم تجاهل الرسم الحالي وتفاصيله.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'رسم جديد', style: 'destructive', onPress: () => reset() }]);
  const changeCity = (cityId: string): void => { if (cityId === draft.cityId) return; const change = () => { reset(cityId); const city = choices.find(item => String(item.id) === cityId); if (city?.coordinates) setCamera({ coordinates: city.coordinates, zoom: city.zoom }); }; if (draft.segments.length || draft.stops.length || draft.nameAr) Alert.alert('تغيير المدينة؟', 'سيبدأ رسم جديد للمدينة المختارة.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'تغيير المدينة', style: 'destructive', onPress: change }]); else change(); };
  const chooseStop = (id: string): void => { const stop = draft.stops.find(item => item.id === id); if (!stop) return; setStopId(id); setStopName(stop.name); setStopCoordinates(`${stop.coordinate.latitude}, ${stop.coordinate.longitude}`); setCamera({ coordinates: stop.coordinate, zoom: 17 }); setPanel('stops'); };
  async function submit(requireLogin = false): Promise<void> {
    if (!current || working.current || !active) return;
    const value = draftRef.current, origin = account.user ? session : undefined;
    setError(null); setNotice(null);
    try {
      if (!selectedCity) throw new Error('اختر مدينة متاحة ضمن نطاق حسابك.');
      buildPayload(value);
      if (edit && !account.user) throw new Error('سجّل الدخول لتحميل المسار الأصلي قبل إرسال تعديله.');
      if (requireLogin && !account.user) {
        working.current = true; setBusy(true);
        await writeDocument(pendingKey, { version: 1, ownerId: owner, target, draft: value } satisfies PendingStudio);
        await account.signIn(); setNotice('راجع المسودة ثم أرسلها باسم حسابك.'); return;
      }
      working.current = true; setBusy(true);
      const id = await studioClient.save(value, origin);
      if (origin === undefined && api.getSessionGeneration() !== session) { setNotice(`أُرسلت المسودة كزائر برقم ${id}.`); return; }
      setSubmitted({ id, anonymous: origin === undefined, linked: value.editingRouteId !== null });
      if (origin !== undefined) assign({ ...value, editingDraftId: id }, documentKey);
    } catch (reason) { const fields = reason instanceof ApiError ? Object.values(reason.fields).flat() : []; setError(fields.length ? fields.join('\n') : reason instanceof Error ? reason.message : 'تعذر حفظ المسودة.'); }
    finally { working.current = false; setBusy(false); }
  }
  const send = (): void => { if (draft.editingRouteId) Alert.alert('إرسال تعديل المسار؟', 'سيُخفى الخط المنشور حتى تُراجع التعديلات وتُعتمد.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'إرسال للمراجعة', onPress: () => { void submit(); } }]); else void submit(); };
  const color = routeColor(draft.colorIndex), selectedStop = draft.stops.find(stop => stop.id === stopId);
  const vertices = useMemo(() => draft.segments.flatMap((line, lineIndex) => line.map((coordinate, index) => ({ id: `${lineIndex}:${index}`, segment: lineIndex, index, coordinate }))), [draft.segments]);
  const mapPins = useMemo(() => [
    ...(showReference ? reference.data?.stops.map(stop => ({ id: `reference:${stop.id}`, name: stop.name, coordinate: stop.coordinate, color: '#8A968E', symbol: 'bus' })) ?? [] : []),
    ...draft.stops.map((stop, index) => ({ id: `stop:${stop.id}`, name: stop.name || `موقف ${index + 1}`, coordinate: stop.coordinate, color, monogram: String(index + 1) })),
    ...vertices.filter(item => vertices.length <= 150 || item.index === 0 || item.index === draft.segments[item.segment]!.length - 1 || vertex?.segment === item.segment && vertex.index === item.index).map(item => ({ id: `vertex:${item.id}`, name: `نقطة ${item.index + 1}، جزء ${item.segment + 1}`, coordinate: item.coordinate, color, symbol: 'circle.fill' }))
  ], [showReference, reference.data, draft.stops, draft.segments, color, vertices, vertex]);
  const lines = useMemo(() => [
    ...(showReference ? reference.data?.routes.flatMap(route => route.segments.map((coordinates, index) => ({ id: `reference:${route.id}:${index}`, coordinates, color: `${routeColor(route.colorIndex)}44` }))) ?? [] : []),
    ...draft.segments.filter(line => line.length > 1).map((coordinates, index) => ({ id: `drawn:${index}`, coordinates, color }))
  ], [showReference, reference.data, draft.segments, color]);
  const conflict = useMemo(() => overlapsRoute(draft.segments, reference.data?.routes.flatMap(route => route.segments) ?? []), [draft.segments, reference.data]);
  const map = <View style={{ flex: 1, gap: 10, minHeight: 380 }}><View style={{ flex: 1, minHeight: 300 }}><MapView pins={mapPins} lines={lines} camera={camera} onMapPress={mapPoint} onCameraChange={value => { viewport.current = value; }} onPinPress={id => { if (id.startsWith('stop:')) chooseStop(id.slice(5)); else if (id.startsWith('vertex:')) { const [line, point] = id.slice(7).split(':').map(Number); if (line !== undefined && point !== undefined) { setVertex({ segment: line, index: point }); setSegment(line); setTool('move-vertex'); } } }} />{tool !== 'idle' ? <View pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '50%', transform: [{ translateX: -14 }, { translateY: -14 }] }}><NativeSymbol name="plus.circle.fill" size={28} /></View> : null}</View><View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center' }}><NativeIconAction title="تراجع عن تعديل الرسم" systemImage="arrow.uturn.backward" disabled={!history.length || busy} onPress={undo} /><NativeIconAction title="إنهاء الرسم" systemImage="checkmark" disabled={busy} onPress={() => setTool('idle')} /><NativeIconAction title="ملاءمة المسار" systemImage="arrow.up.left.and.arrow.down.right" onPress={() => { const fit = cameraForCoordinates(draft.segments.flat()); if (fit) setCamera(fit); }} /></View>{tool !== 'idle' ? <NativeAction title="تطبيق الأداة على مركز الخريطة" disabled={busy || !current} onPress={() => mapPoint(viewport.current?.center ?? camera.coordinates)} /> : null}</View>;
  const header = <View style={{ gap: 12 }}><ProjectIcon name="transit" size={46} /><Heading subtitle="ارسم مساراً وأرسله للمراجعة">ترانزيت ستوديو</Heading><RequestStatus resource={cities} />{initializing ? <Label>جارٍ قراءة المسودة.</Label> : null}{error ? <Section><Label style={{ color: colors.danger }}>{error}</Label>{loadedKey !== documentKey ? <NativeAction title="إعادة القراءة" onPress={() => setRevision(value => value + 1)} /> : null}</Section> : null}{notice ? <Label>{notice}</Label> : null}</View>;
  const editor = current ? <View style={{ gap: 14 }}><NativePicker label="المدينة" value={draft.cityId} options={choices.map(city => ({ value: String(city.id), label: city.nameAr }))} onChange={changeCity} disabled={busy} /><NativePicker<Tool> label="أداة الخريطة" value={tool} options={tools} onChange={setTool} disabled={busy} /><NativeToggle title="إظهار الخطوط والمواقف المنشورة للمقارنة" value={showReference} onChange={setShowReference} />{showReference ? <RequestStatus resource={reference} /> : null}{conflict ? <Label secondary>الرسم يتداخل مع مسار موجود. تحقّق قبل إرسال مسار مكرر.</Label> : null}
    <Section><Heading>المسار</Heading><Label>{vertices.length} نقطة · {draft.segments.length} جزء · {draft.stops.length} موقف</Label>{draft.segments.length > 1 ? <NativePicker label="جزء المسار" value={String(segment)} options={draft.segments.map((_line, index) => ({ value: String(index), label: `الجزء ${index + 1}` }))} onChange={value => setSegment(Number(value))} /> : null}<NativeAction title="رسم أو إكمال المسار" onPress={() => setTool('append')} /><NativeAction title="قائمة نقاط المسار" disabled={!vertices.length} onPress={() => setPanel('vertices')} /><NativeAction title="إدراج نقطة على المسار" disabled={!vertices.length} onPress={() => setTool('insert')} /><NativeAction title="إضافة جزء منفصل" onPress={() => { const index = draft.segments.length; apply(previous => ({ ...previous, segments: [...previous.segments, []] }), true); setSegment(index); setTool('append'); }} />{vertex ? <><Label>النقطة {vertex.index + 1} من الجزء {vertex.segment + 1} مختارة. اختر موقعها الجديد على الخريطة.</Label><NativeAction title="حذف النقطة المختارة" destructive disabled={(draft.segments[vertex.segment]?.length ?? 0) <= 2} onPress={() => { apply(previous => withSegments(previous, previous.segments.map((line, index) => index === vertex.segment ? line.filter((_coordinate, position) => position !== vertex.index) : line)), true); setVertex(null); }} /></> : null}<NativeAction title="بدء رسم جديد" destructive onPress={askReset} /></Section>
    <Section><Heading>المواقف</Heading><NativeAction title="إضافة موقف على الخريطة" onPress={() => setTool('stop')} /><NativeAction title={`قائمة المواقف (${draft.stops.length})`} onPress={() => setPanel('stops')} /><Label secondary>تُحاذى المواقف مع المسار عند إضافتها أو نقلها وعند تعديل النقاط.</Label></Section>
    <Section><Heading>لون المسار</Heading><NativePicker label="لون المسار" value={String(draft.colorIndex)} options={facts.route_palette.map((hex, index) => ({ value: String(index), label: `${index + 1} · ${hex}` }))} onChange={value => apply(previous => ({ ...previous, colorIndex: Number(value) }))} /><View style={{ height: 12, borderRadius: 8, backgroundColor: color }} /></Section>
    <Section><Heading>تفاصيل المسار</Heading><FormField label="اسم المسار بالعربية" autoCorrect={false} value={draft.nameAr} onChange={value => apply(previous => ({ ...previous, nameAr: value }))} maxLength={255} /><FormField label="اسم المسار بالإنجليزية (اختياري)" value={draft.nameEn} onChange={value => apply(previous => ({ ...previous, nameEn: value }))} maxLength={255} /><FormField label="التعرفة / سعر التذكرة (ل.س، اختياري)" value={draft.price} onChange={value => apply(previous => ({ ...previous, price: value }))} keyboardType="number-pad" /><FormField label="ملاحظات إضافية" value={draft.notes} onChange={value => apply(previous => ({ ...previous, notes: value }))} multiline /></Section>
    {submitted ? <Section><Heading>تم إرسال المسودة للمراجعة</Heading><Label>رقم المسودة: {submitted.id}</Label><Label>{submitted.anonymous ? 'أُرسلت كزائر. لا تُنسب إلى حساب.' : submitted.linked ? 'أُخفي الخط المنشور حتى تُراجع التعديلات.' : 'ستظهر على الخريطة بعد اعتمادها.'}</Label>{!submitted.anonymous ? <NativeAction title="تعديل المسار الحالي" onPress={() => setSubmitted(null)} /> : null}<NativeAction title="رسم مسار جديد" onPress={() => reset()} /><NativeAction title="العودة لخريطة المواصلات" onPress={() => navigation.open('transit', { cityId: draft.cityId })} /></Section> : <Section>{edit && !account.user ? <NativeAction title="تسجيل الدخول لتحميل المسار" disabled={!account.ready || account.busy} onPress={() => { void account.signIn().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول.')); }} /> : account.user ? <NativeAction title={busy ? 'جارٍ الحفظ' : 'إرسال للمراجعة باسمك'} prominent disabled={busy || !selectedCity} onPress={send} /> : <><NativeAction title="تسجيل الدخول والإرسال باسمك" disabled={busy} onPress={() => { void submit(true); }} /><NativeAction title="إرسال كزائر" disabled={busy || !selectedCity} onPress={send} /></>}</Section>}
  </View> : null;
  const primary = <ScrollView contentContainerStyle={contentStyle}>{header}{editor}</ScrollView>;
  return <><AdaptivePanes primary={primary} secondary={<View style={{ flex: 1, padding: 18 }}>{current ? map : header}</View>} compact={<ScrollView contentContainerStyle={contentStyle}>{header}{current ? <View style={{ height: 430 }}>{map}</View> : null}{editor}</ScrollView>} />
    <Modal visible={panel !== null} presentationStyle="pageSheet" onRequestClose={() => setPanel(null)}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><FlatList data={panel === 'vertices' ? vertices.map(item => ({ key: item.id, title: `الجزء ${item.segment + 1}، النقطة ${item.index + 1}`, coordinate: item.coordinate, choose: () => { setVertex({ segment: item.segment, index: item.index }); setSegment(item.segment); setTool('move-vertex'); setCamera({ coordinates: item.coordinate, zoom: 17 }); setPanel(null); } })) : draft.stops.map((stop, index) => ({ key: stop.id, title: stop.name || `موقف ${index + 1}`, coordinate: stop.coordinate, choose: () => chooseStop(stop.id) }))} keyExtractor={item => item.key} contentContainerStyle={contentStyle} ListHeaderComponent={<View style={{ gap: 12 }}><NativeAction title="تم" onPress={() => setPanel(null)} /><Heading>{panel === 'vertices' ? 'نقاط المسار' : 'المواقف'}</Heading>{panel === 'stops' && selectedStop ? <Section><FormField label="اسم الموقف" value={stopName} onChange={setStopName} /><NativeAction title="حفظ اسم الموقف" onPress={() => apply(previous => ({ ...previous, stops: previous.stops.map(stop => stop.id === selectedStop.id ? { ...stop, name: stopName } : stop) }))} /><FormField label="إحداثيات الموقف" value={stopCoordinates} onChange={setStopCoordinates} /><NativeAction title="حفظ موقع الموقف ومحاذاته" onPress={() => { const point = parseCoordinates(stopCoordinates); if (!point || !pointInCity(point)) { setError('إحداثيات الموقف غير صالحة أو خارج المدينة.'); return; } apply(previous => ({ ...previous, stops: previous.stops.map(stop => stop.id === selectedStop.id ? { ...stop, coordinate: nearestOnRoute(previous.segments, point).coordinate } : stop) }), true); }} /><NativeAction title="نقل هذا الموقف على الخريطة" onPress={() => { setTool('move-stop'); setPanel(null); }} /><NativeAction title="حذف الموقف" destructive onPress={() => { apply(previous => ({ ...previous, stops: previous.stops.filter(stop => stop.id !== selectedStop.id) }), true); setStopId(null); }} /></Section> : null}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</View>} ItemSeparatorComponent={() => <View style={{ height: 8 }} />} renderItem={({ item }) => <Row title={item.title} subtitle={`${item.coordinate.latitude.toFixed(5)}, ${item.coordinate.longitude.toFixed(5)}`} onPress={item.choose} />} /></SafeAreaView></Modal>
  </>;
}
// PORT NOTE: Native selection plus map tap or center confirmation replaces browser marker dragging. Disconnected server route segments are preserved.
// PORT STATUS: source resources/js/Pages/Transit/studio/Index.tsx and _store/useStudioStore.ts; confidence medium; todos 2 isolated submit/edit integration and native editor/pending-login verification.
