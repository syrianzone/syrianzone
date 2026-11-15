import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { api } from '../../api';
import { FormField, Label, RequestStatus, Row } from '../../components';
import { firstLocation } from '../../location';
import { useForegroundClock } from '../../platform/clock';
import { decodeEvents, decodeWeather, weatherCodeAr } from '../../platform/conditions';
import { formatDuration, formatGregorianSyrian } from '../../platform/dates';
import { useFaithPreferences } from '../../platform/faith-preferences';
import { useFeatureNavigation } from '../../platform/features';
import { useScreenActive } from '../../platform/lifecycle';
import { openExternal } from '../../platform/links';
import { useLocationPreference, governorates } from '../../platform/location';
import { usePrayerTimes } from '../../platform/prayer';
import { QuranNowReading, QuranTransport, RecitationPicker } from '../../platform/quran/components';
import { NativeAction, NativeSegmented, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import type { WidgetInstance } from './model';
import { useWidgetQuery } from './query';
import { bounded, decodeAnswers, decodeFeed, decodeGuides, decodeNearby, decodeRecipe, todoItems } from './widget-model';

type Props = { widget: WidgetInstance; change(patch: Record<string, unknown>): Promise<void> };
function useVisit() { const [error, setError] = useState<string | null>(null); return { error, visit: (url: string) => { void openExternal(url).catch(() => setError('تعذر فتح الرابط.')); } }; }
function Empty({ empty }: { empty: boolean }): React.JSX.Element | null { return empty ? <Label secondary>لا توجد بيانات متاحة حالياً.</Label> : null; }
function ClockWidget({ widget }: Props): React.JSX.Element {
  const now = useForegroundClock();
  return <View style={{ gap: 8 }}><Label style={{ fontSize: 30, lineHeight: 42, fontVariant: ['tabular-nums'] }}>{now.toLocaleTimeString('en-US', { hour12: widget.c.format === '12' })}</Label>{widget.c.showDate !== false ? <Label secondary>{formatGregorianSyrian(now)}</Label> : null}</View>;
}
function WeatherWidget({ widget }: Props): React.JSX.Element {
  const city = String(widget.c.governorate ?? 'damascus');
  const query = useWidgetQuery(`weather:${city}`, useCallback(signal => api.request('weather', decodeWeather, { signal, params: { governorate: city } }), [city]), 600000, 900000);
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? <><Label secondary>{governorates.find(row => row.id === city)?.nameAr}</Label><Label style={{ fontSize: 30, lineHeight: 40 }}>{query.data.temp}°</Label><Label>{query.data.description}</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>{query.data.forecast.slice(0, 4).map((day, index) => <View key={day.date}><Label secondary>{index === 0 ? 'اليوم' : new Date(`${day.date}T12:00:00`).toLocaleDateString('ar-SY', { weekday: 'short' })}</Label><Label>{day.max}° / {day.min}°</Label><Label secondary>{weatherCodeAr(day.code)}</Label></View>)}</View></> : null}</View>;
}
function PrayerWidget({ widget }: Props): React.JSX.Element {
  const location = useLocationPreference(), faith = useFaithPreferences(), pinned = governorates.some(city => city.id === widget.c.governorate);
  const query = usePrayerTimes(pinned ? { ...location, city: String(widget.c.governorate), mode: 'city', geo: null, useCustomCoords: false } : location, Number(widget.c.method) || faith.method, faith.ready);
  const schedule = query.schedule({ rollover: false });
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? schedule?.next ? <><Label>الصلاة القادمة: {schedule.next.label}</Label><Label>{schedule.next.time}، بعد {formatDuration(schedule.next.remainingMs)}</Label>{query.data.hijri ? <Label secondary>{query.data.hijri.day} {query.data.hijri.month} {query.data.hijri.year} هـ</Label> : null}</> : <Label secondary>انتهت صلوات اليوم</Label> : null}</View>;
}
function PomodoroWidget({ widget }: Props): React.JSX.Element {
  const active = useScreenActive(), work = bounded(widget.c.work, 5, 90, 25), rest = bounded(widget.c.rest, 1, 30, 5);
  const [phase, setPhase] = useState('work'), [running, setRunning] = useState(false), [remaining, setRemaining] = useState(work * 60000), deadline = useRef<number | null>(null);
  const duration = (phase === 'work' ? work : rest) * 60000;
  useEffect(() => { deadline.current = null; setRunning(false); setRemaining(duration); }, [duration, phase]);
  useEffect(() => {
    if (!active || !running) return;
    const tick = (): void => { const next = Math.max(0, (deadline.current ?? 0) - Date.now()); setRemaining(next); if (!next) { setRunning(false); deadline.current = null; } };
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [active, running]);
  const { colors } = useTheme(), elapsed = duration > 0 ? Math.min(1, (duration - remaining) / duration) : 0;
  return <View style={{ gap: 8 }}><NativeSegmented value={phase} options={[{ value: 'work', label: 'عمل' }, { value: 'rest', label: 'راحة' }]} onChange={setPhase} />
    <Label style={{ fontSize: 28, lineHeight: 40 }}>{`${String(Math.floor(Math.ceil(remaining / 1000) / 60)).padStart(2, '0')}:${String(Math.ceil(remaining / 1000) % 60).padStart(2, '0')}`}</Label>
    <View accessibilityRole="progressbar" accessibilityLabel="تقدم جلسة بومودورو" accessibilityValue={{ min: 0, max: 100, now: Math.round(elapsed * 100) }} style={{ height: 4, borderRadius: 2, backgroundColor: colors.elevated }}><View style={{ height: 4, borderRadius: 2, width: `${elapsed * 100}%`, backgroundColor: colors.accent }} /></View>
    <NativeAction title={running ? 'إيقاف مؤقت' : 'ابدأ'} disabled={!running && remaining <= 0} onPress={() => { if (running) { setRemaining(Math.max(0, (deadline.current ?? 0) - Date.now())); deadline.current = null; setRunning(false); } else { deadline.current = Date.now() + remaining; setRunning(true); } }} />
    <NativeAction title="إعادة ضبط" onPress={() => { setRunning(false); deadline.current = null; setRemaining(duration); }} /></View>;
}
function NotesWidget({ widget, change }: Props): React.JSX.Element {
  const { colors } = useTheme(), [draft, setDraft] = useState(typeof widget.c.text === 'string' ? widget.c.text : ''), editing = useRef(false);
  useEffect(() => { if (!editing.current) setDraft(typeof widget.c.text === 'string' ? widget.c.text : ''); }, [widget.c.text]);
  return <TextInput multiline accessibilityLabel="ملاحظات" placeholder="اكتب ملاحظاتك هنا" placeholderTextColor={colors.secondary} maxLength={4000} value={draft}
    onFocus={() => { editing.current = true; }} onBlur={() => { editing.current = false; }} onChangeText={text => { setDraft(text); void change({ text }).catch(() => undefined); }} style={{ color: colors.text, minHeight: 120, textAlign: 'right', writingDirection: 'rtl', textAlignVertical: 'top', fontSize: 16, lineHeight: 26 }} />;
}
function TodoWidget({ widget, change }: Props): React.JSX.Element {
  const [items, setItems] = useState(() => todoItems(widget.c.items)), [draft, setDraft] = useState(''), latest = useRef(items), pending = useRef(0);
  useEffect(() => { if (!pending.current) { const adopted = todoItems(widget.c.items); latest.current = adopted; setItems(adopted); } }, [widget.c.items]);
  function commit(update: (value: typeof items) => typeof items): void { const next = update(latest.current); latest.current = next; setItems(next); pending.current++; void change({ items: next }).catch(() => undefined).finally(() => { pending.current--; }); }
  function add(): void { if (latest.current.length < 50 && draft.trim()) { const text = draft.trim().slice(0, 200); commit(previous => [...previous, { id: `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`, text, done: false }]); setDraft(''); } }
  return <View style={{ gap: 8 }}><Label secondary>متبقي {items.filter(item => !item.done).length}</Label><FormField label="مهمة جديدة" value={draft} maxLength={200} onChange={setDraft} /><NativeAction title={items.length >= 50 ? 'بلغت الحد الأقصى للمهام' : 'إضافة مهمة'} disabled={items.length >= 50 || !draft.trim()} onPress={add} />
    <Empty empty={!items.length} />{items.filter(item => !widget.c.hideCompleted || !item.done).map(item => <View key={item.id} style={{ gap: 4 }}><NativeToggle title={item.text} value={item.done} onChange={done => commit(previous => previous.map(row => row.id === item.id ? { ...row, done } : row))} /><NativeAction title={`حذف المهمة: ${item.text}`} systemImage="trash" onPress={() => commit(previous => previous.filter(row => row.id !== item.id))} /></View>)}</View>;
}
function FeedWidget({ widget }: Props): React.JSX.Element {
  const source = String(widget.c.source ?? 'jard'), { visit, error } = useVisit();
  const query = useWidgetQuery(`rss:${source}`, useCallback(signal => api.request('feed', decodeFeed, { signal, params: { source } }), [source]), 600000, 900000);
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? <><Label>{query.data.title}</Label><Empty empty={!query.data.items.length} />{query.data.items.map((item, index) => <Row key={`${item.url}:${index}`} title={item.title} subtitle={item.at ? new Date(item.at).toLocaleDateString('ar-SY', { day: '2-digit', month: '2-digit' }) : ''} onPress={() => { if (item.url) visit(item.url); }} />)}</> : null}{error ? <Label>{error}</Label> : null}</View>;
}
function AnswersWidget({ widget }: Props): React.JSX.Element {
  const limit = bounded(widget.c.limit, 3, 20, 8), { visit, error } = useVisit();
  const query = useWidgetQuery(`answers:${limit}`, useCallback(signal => api.request('answers', decodeAnswers, { signal, params: { limit } }), [limit]), 300000, 600000);
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? <><Empty empty={!query.data.length} />{query.data.map(item => <Row key={item.id} title={item.title} subtitle={`${item.tags.join('، ')}، ${item.count} إجابة`} onPress={() => visit(item.url)} />)}</> : null}{error ? <Label>{error}</Label> : null}</View>;
}
function RecipeWidget(): React.JSX.Element {
  const { visit, error } = useVisit(), [broken, setBroken] = useState(false);
  const query = useWidgetQuery('recipe:today', useCallback(signal => api.request('recipe-of-the-day', decodeRecipe, { signal }), []), 21600000);
  const recipe = query.data;
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{recipe ? <>{recipe.image && !broken ? <Image source={{ uri: recipe.image }} style={{ height: 110, borderRadius: 12 }} contentFit="cover" accessibilityLabel={recipe.name} onError={() => setBroken(true)} /> : null}<Row title={recipe.name} subtitle={[recipe.city, recipe.time, recipe.difficulty, recipe.tags.slice(0, 3).join('، ')].filter(Boolean).join('، ')} onPress={() => visit(recipe.url)} /><Label secondary>food.syrian.zone</Label></> : !query.loading && !query.error ? <Empty empty /> : null}{error ? <Label>{error}</Label> : null}</View>;
}
function EventsWidget({ widget }: Props): React.JSX.Element {
  const city = String(widget.c.governorate ?? 'damascus'), { visit, error } = useVisit();
  const query = useWidgetQuery(`events:${city}`, useCallback(signal => api.request('events/today', decodeEvents, { signal, params: { governorate: city } }), [city]), 600000, 900000);
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? <>{query.data.fallback ? <Label secondary>لا توجد فعاليات محلية اليوم، نعرض فعاليات من باقي المحافظات.</Label> : null}<Empty empty={!query.data.events.length} />{query.data.events.map(item => <Row key={item.id} title={item.name} subtitle={`${item.time ? item.time.slice(0, 5) : 'طوال اليوم'}، ${item.online ? 'عبر الإنترنت' : item.address || 'مكان غير محدد'}، ${item.free ? 'مجاني' : item.price ?? ''} ${item.category}`} onPress={() => visit(item.url)} />)}</> : null}{error ? <Label>{error}</Label> : null}</View>;
}
function GuidesWidget({ widget }: Props): React.JSX.Element {
  const navigation = useFeatureNavigation(), sort = String(widget.c.sort ?? 'submissions');
  const query = useWidgetQuery(`guides:${sort}`, useCallback(signal => api.request('guides', decodeGuides, { signal, params: { sort } }), [sort]), 300000);
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? <><Empty empty={!query.data.length} />{query.data.map(item => <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{item.avatar ? <Image source={{ uri: item.avatar }} style={{ width: 30, height: 30, borderRadius: 15 }} accessibilityLabel={item.name} /> : null}<View style={{ flex: 1 }}><Row title={`${item.rank}. ${item.name}`} subtitle={`${item.approved} مساهمة، ${item.saves} حفظ`} onPress={() => navigation.open('mishwar', { guide: String(item.id) })} /></View></View>)}</> : null}</View>;
}
function NearbyWidget({ widget }: Props): React.JSX.Element {
  const navigation = useFeatureNavigation(), [point, setPoint] = useState<{ lat: number; lng: number } | null>(null), [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), focused = useIsFocused();
  const request = useRef<AbortController | null>(null), radius = bounded(widget.c.radius_km, 1, 25, 10);
  useEffect(() => {
    if (!focused) request.current?.abort();
    const subscription = AppState.addEventListener('change', state => { if (state === 'background') request.current?.abort(); });
    return () => { subscription.remove(); request.current?.abort(); };
  }, [focused]);
  async function locate(): Promise<void> { if (busy) return; setBusy(true); setError(null); const controller = new AbortController(); request.current?.abort(); request.current = controller;
    try { const permission = await Location.requestForegroundPermissionsAsync(); if (!permission.granted) throw new Error('إذن الموقع مرفوض. يمكنك السماح به من إعدادات الجهاز.');
      const coordinates = await firstLocation(async (onPosition, onError) => Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 1000, distanceInterval: 0 }, value => onPosition(value.coords), onError), controller.signal, 20000);
      if (!controller.signal.aborted) setPoint({ lat: coordinates.latitude, lng: coordinates.longitude });
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر تحديد الموقع.'); } finally { setBusy(false); } }
  const query = useWidgetQuery(`nearby:${point?.lat}:${point?.lng}:${radius}`, useCallback(signal => api.request('places/nearby', decodeNearby, { signal, params: { lat: point?.lat, lng: point?.lng, radius_km: radius } }), [point?.lat, point?.lng, radius]), 300000, null, point !== null);
  return <View style={{ gap: 8 }}><NativeAction title={busy ? 'جارٍ تحديد الموقع' : point ? 'تحديث موقعي' : 'استخدام موقعي للأماكن القريبة'} disabled={busy} onPress={() => { void locate(); }} />{error ? <Label>{error}</Label> : null}<RequestStatus resource={query} />{query.data ? <><Empty empty={!query.data.length} />{query.data.map(item => <Row key={item.id} title={item.name} subtitle={`${item.category}، ${(item.distance / 1000).toFixed(1)} كم`} onPress={() => navigation.open('place', { id: String(item.id) })} />)}</> : null}</View>;
}
function TransitWidget(): React.JSX.Element {
  const navigation = useFeatureNavigation();
  const query = useWidgetQuery('transit:cities', useCallback(signal => api.cities(signal), []), 1800000);
  return <View style={{ gap: 8 }}><RequestStatus resource={query} />{query.data ? <><Empty empty={!query.data.length} />{query.data.map(item => <Row key={item.id} title={item.nameAr} subtitle={`${item.routeCount} خط`} onPress={() => navigation.open('transit', { cityId: String(item.id) })} />)}</> : null}</View>;
}
export function WidgetView(props: Props): React.JSX.Element {
  switch (props.widget.d) {
    case 'clock': return <ClockWidget {...props} />; case 'weather': return <WeatherWidget {...props} />; case 'prayer': return <PrayerWidget {...props} />;
    case 'quran': return <View style={{ gap: 8 }}><QuranNowReading compact /><QuranTransport /><RecitationPicker /></View>;
    case 'pomodoro': return <PomodoroWidget {...props} />; case 'notes': return <NotesWidget {...props} />; case 'todo': return <TodoWidget {...props} />;
    case 'rss': return <FeedWidget {...props} />; case 'answers': return <AnswersWidget {...props} />; case 'recipe': return <RecipeWidget />;
    case 'events-today': return <EventsWidget {...props} />; case 'guides': return <GuidesWidget {...props} />; case 'places-nearby': return <NearbyWidget {...props} />; case 'transit-cities': return <TransitWidget />;
    default: return <Label secondary>هذا الويدجت غير مدعوم في هذا الإصدار. بقيت إعداداته محفوظة.</Label>;
  }
}

// PORT STATUS: source resources/js/Pages/Board/_widgets/*/View.tsx; confidence medium; todos 2 native compact tile interactions and foreground polling verification.
