import { useEffect, useMemo, useState } from 'react';
import { AppState, Modal, ScrollView, SectionList, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, Row, SearchField, Section } from '../../components';
import { MapView } from '../../MapView';
import { NativeAction, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { openExternal, shareText } from '../../platform/links';
import type { FeatureScreenProps } from '../../platform/features';
import { buildShareMessage, crossings, DEFAULT_CENTER, DIRECTION_LABELS, DIRECTION_ORDER, formatIntl, isWindowOpen, meta, SOURCE_PAGE_URL, statusOf, STATUS_TEXT, syriaClock, windowLabel, type Crossing } from './model';

// PORT NOTE: Marker/list inspection uses an accessible native sheet instead of desktop hover cards.
function useClock(interval: number): ReturnType<typeof syriaClock> | null {
  const focused = useIsFocused();
  const [clock, setClock] = useState<ReturnType<typeof syriaClock> | null>(null);
  useEffect(() => {
    if (!focused) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const sync = () => setClock(syriaClock());
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const start = () => { stop(); sync(); timer = setInterval(sync, interval); };
    if (AppState.currentState === 'active') start();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') start(); else stop(); });
    return () => { stop(); subscription.remove(); };
  }, [focused, interval]);
  return clock;
}
function SyriaClock(): React.JSX.Element {
  const clock = useClock(1000);
  return <View><Label secondary>سوريا ({clock?.offset ?? 'Asia/Damascus'})</Label><Label style={{ fontVariant: ['tabular-nums'], fontSize: 22 }}>{clock?.text ?? '--:--:--'}</Label></View>;
}
export function CrossingsScreen({ params }: FeatureScreenProps): React.JSX.Element {
  const { colors } = useTheme();
  const clock = useClock(30_000);
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selected, setSelected] = useState<Crossing | null>(() => crossings.find(item => String(item.n) === params.c) ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setSelected(crossings.find(item => String(item.n) === params.c) ?? null); }, [params.c]);
  const minutes = clock?.minutes ?? null;
  const filtered = useMemo(() => crossings.filter(item => !query.trim() || item.name.includes(query.trim()) || item.country?.includes(query.trim())), [query]);
  const groups = useMemo(() => DIRECTION_ORDER.map(direction => ({ title: DIRECTION_LABELS[direction], data: filtered.filter(item => item.direction === direction) })).filter(group => group.data.length), [filtered]);
  const counts = useMemo(() => crossings.reduce((count, item) => { const status = statusOf(item, minutes); count[status] += 1; return count; }, { open: 0, closed: 0, opening: 0, pending: 0 }), [minutes]);
  const pins = useMemo(() => filtered.map(item => ({ id: String(item.n), name: `${item.name}، ${STATUS_TEXT[statusOf(item, minutes)]}`, coordinate: item.coordinate, symbol: item.category === 'port' ? 'ferry' : 'mappin', color: statusOf(item, minutes) === 'open' ? colors.success : statusOf(item, minutes) === 'closed' ? colors.danger : colors.secondary })), [filtered, minutes, colors.success, colors.danger, colors.secondary]);
  const perform = async (action: () => Promise<void>) => { setError(null); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء'); } };
  const header = <View style={{ gap: 16 }}><Heading subtitle={`بيانات المنافذ والمرافئ، محدّثة حتى ${meta.asOf}`}>المنافذ الحدودية</Heading><SyriaClock />
    <Label>{minutes === null ? 'جارٍ التحقق من ساعات العمل' : `${counts.open} مفتوح، ${counts.closed} مغلق، ${counts.opening} قيد الافتتاح`}</Label>
    <SearchField value={query} onChange={setQuery} placeholder="ابحث عن منفذ أو دولة" />
    <NativeSegmented options={[{ value: 'list', label: 'القائمة' }, { value: 'map', label: 'الخريطة' }]} value={view} onChange={setView} />
    <Label secondary>{filtered.length} منفذاً</Label></View>;
  const map = <View style={{ flex: 1, padding: 12 }}><MapView pins={pins} center={DEFAULT_CENTER} camera={{ coordinates: selected?.coordinate ?? DEFAULT_CENTER, zoom: selected ? 9 : 6.1 }} onPinPress={id => setSelected(crossings.find(item => String(item.n) === id) ?? null)} /></View>;
  const list = <SectionList sections={groups} keyExtractor={item => String(item.n)} contentContainerStyle={contentStyle} stickySectionHeadersEnabled={false}
    ListHeaderComponent={header} ListEmptyComponent={<EmptyState title="لا توجد منافذ مطابقة" detail="جرّب اسم منفذ أو دولة أخرى" />}
    renderSectionHeader={({ section }) => <Label accessibilityRole="header" style={{ fontSize: 19, fontWeight: '700', paddingTop: 16, paddingBottom: 8 }}>{section.title}</Label>}
    renderItem={({ item }) => <View style={{ marginBottom: 9 }}><Row title={item.name} subtitle={[item.country ?? 'منفذ بحري', STATUS_TEXT[statusOf(item, minutes)], item.opType].filter(Boolean).join('، ')} symbol={item.category === 'port' ? 'ferry' : 'mappin'} onPress={() => setSelected(item)} /></View>}
    ListFooterComponent={<Section><Label secondary>تستند الحالات إلى ساعات العمل والبيانات المنشورة، وقد تتغير دون إشعار. تحقّق قبل السفر.</Label><Label secondary>{meta.source}</Label><NativeAction title="المصدر (مؤقتاً)" systemImage="arrow.up.right.square" onPress={() => void perform(() => openExternal(SOURCE_PAGE_URL))} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</Section>} />;
  return <><AdaptivePanes primary={list} secondary={map} compact={view === 'map' ? <View style={{ flex: 1 }}><View style={contentStyle}>{header}</View>{map}</View> : list} />
    <Modal visible={selected !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
      <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>{selected ? <>
        <NativeAction title="إغلاق التفاصيل" systemImage="xmark" onPress={() => { setSelected(null); setError(null); }} />
        <Heading subtitle={selected.country ?? 'منفذ بحري'}>{selected.name}</Heading>
        <Section><Label style={{ fontWeight: '700', color: statusOf(selected, minutes) === 'closed' ? colors.danger : colors.accent }}>{STATUS_TEXT[statusOf(selected, minutes)]}</Label>
          {selected.opType ? <Label>{selected.opType}</Label> : null}{selected.override?.message ? <Label style={{ color: colors.danger }}>{selected.override.message}</Label> : null}
          {selected.windows.map((window, index) => <Label key={index}>{window.label ? `${window.label}: ` : ''}{windowLabel(window)}{minutes !== null && isWindowOpen(window, minutes) ? '، ضمن ساعات العمل الآن' : ''}</Label>)}
          <Label secondary>{formatIntl(selected.intl)}</Label>
          <NativeAction title="التواصل عبر واتساب" onPress={() => void perform(() => openExternal(`https://wa.me/${selected.intl}`))} />
          <NativeAction title="فتح الموقع في الخرائط" systemImage="map" onPress={() => void perform(() => openExternal(selected.mapsUrl))} />
          <NativeAction title="مشاركة تفاصيل المنفذ" systemImage="square.and.arrow.up" onPress={() => void perform(() => shareText(buildShareMessage(selected)))} />
          {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
        </Section><Label secondary>آخر تحديث للبيانات: {meta.asOf}. تحقّق من حالة المنفذ قبل السفر.</Label>
      </> : null}</ScrollView>} />
    </Modal></>;
}
// PORT STATUS: source resources/js/Pages/Crossings/Index.tsx; confidence medium; todos 0.
