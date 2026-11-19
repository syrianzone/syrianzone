import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { api } from '../../api';
import { contentStyle, EmptyState, Heading, Label, RequestStatus, Row, SearchField, Section } from '../../components';
import { useResource } from '../../resource';
import { useTheme } from '../../ui/theme';
import { NativeAction, NativeIconAction, NativePicker, NativeSymbol } from '../../ui/native';
import { ProjectIcon } from '../../ui/graphics';
import { useFeatureNavigation } from '../../platform/features';
import { useAccount } from '../../platform/account';
import { openExternal } from '../../platform/links';
import { readDocument, writeDocument } from '../../platform/storage';
import { resolvePlaceLabel, resolveWeatherPoint, useLocationPreference } from '../../platform/location';
import { usePrayerTimes } from '../../platform/prayer';
import { text } from '../../platform/validation';
import crossingData from '../../../../resources/data/crossings.json';
import { useFaithPreferences } from '../../platform/faith-preferences';
import governorates from '../../../../resources/data/governorates.json';
import { bundledCatalogue, decodeEvents, decodeNavigation, decodeSearch, decodeWeather, gameSearchResults, matchesSearch, weatherSymbol, type CustomLink, type NavigationItem, type SearchResult } from './model';
import { formatGregorianSyrian, formatGregorianSyrianShort, formatHijriDate, surahs } from './source';
import { useHomePreferences } from './preferences';
import { HomeSettings } from './Settings';
import { LinkEditor } from './LinkEditor';

type Scope = 'all' | 'tools' | 'transit' | 'muslim' | 'games' | 'directory';
const scopes: { value: Scope; label: string }[] = [ { value: 'all', label: 'الكل' }, { value: 'tools', label: 'الأدوات' }, { value: 'transit', label: 'ترانزيت' }, { value: 'muslim', label: 'الركن الإسلامي' }, { value: 'games', label: 'الألعاب' }, { value: 'directory', label: 'الأدلة' } ];

function Artwork({ item }: { item: NavigationItem }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return item.image && !failed ? <Image source={{ uri: item.image }} style={{ width: 48, height: 48 }} contentFit="contain" onError={() => setFailed(true)} accessible={false} />
    : item.iconKey ? <ProjectIcon name={item.iconKey} size={48} /> : <NativeSymbol name="globe" size={40} />;
}
function CustomArtwork({ link }: { link: CustomLink }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  if (link.icon && link.icon !== '🔗') return <Text accessible={false} style={{ fontSize: 40 }}>{link.icon}</Text>;
  return failed ? <NativeSymbol name="globe" size={40} /> : <Image source={{ uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(link.url).hostname)}&sz=64` }} style={{ width: 42, height: 42 }} onError={() => setFailed(true)} accessible={false} />;
}
function useClock(enabled: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const start = () => { stop(); setNow(new Date()); timer = setInterval(() => setNow(new Date()), 30_000); };
    if (AppState.currentState === 'active') start();
    const listener = AppState.addEventListener('change', value => { if (value === 'active') start(); else stop(); });
    return () => { stop(); listener.remove(); };
  }, [enabled]);
  return now;
}
export function HomeScreen(): React.JSX.Element {
  const { colors } = useTheme(), focused = useIsFocused(), navigation = useFeatureNavigation(), account = useAccount();
  const { width, fontScale } = useWindowDimensions();
  const preferences = useHomePreferences(), location = useLocationPreference();
  const faith = useFaithPreferences();
  const [settings, setSettings] = useState(false), [editor, setEditor] = useState<CustomLink | 'new' | null>(null), [editMode, setEditMode] = useState(false);
  const [query, setQuery] = useState(''), [debounced, setDebounced] = useState(''), [scope, setScope] = useState<Scope>('all');
  const [notice, setNotice] = useState<string | null>(null), [last, setLast] = useState<string | null>(null);
  const [cachedCatalogue, setCachedCatalogue] = useState(bundledCatalogue);
  const now = useClock(focused);
  useEffect(() => { const timer = setTimeout(() => setDebounced(query.trim()), 200); return () => clearTimeout(timer); }, [query]);
  useEffect(() => { if (focused) void readDocument('last-visited.v1', value => text(value), '').then(setLast).catch(() => setNotice('تعذر قراءة آخر زيارة.')); }, [focused]);
  const catalogue = useResource(useCallback(signal => api.request('navigation', decodeNavigation, { signal }), []), { enabled: focused });
  useEffect(() => { let active = true; void readDocument('navigation.v1', value => decodeNavigation({ items: value }), bundledCatalogue).then(value => { if (active) setCachedCatalogue(value); }).catch(() => { if (active) setNotice('تعذر قراءة قائمة الأقسام المحفوظة. الأقسام المدمجة متاحة.'); }); return () => { active = false; }; }, []);
  useEffect(() => { if (catalogue.data) void writeDocument('navigation.v1', catalogue.data).catch(() => setNotice('تعذر حفظ قائمة الأقسام. يمكنك متابعة التصفح.')); }, [catalogue.data]);
  const catalogueItems = catalogue.data ?? cachedCatalogue;
  const isSearching = query.trim().length > 0 || scope !== 'all';
  const cities = useResource(useCallback(signal => api.cities(signal), []), { enabled: focused && isSearching && (scope === 'all' || scope === 'transit') });
  const remote = useResource(useCallback(signal => api.request('search/global', decodeSearch, { signal, params: { q: debounced } }), [debounced]), { enabled: focused && isSearching && debounced.length >= 2 });
  const point = resolveWeatherPoint(location);
  const weather = useResource(useCallback(signal => api.request('weather', decodeWeather, { signal, params: { lat: point.lat, lon: point.lon } }), [point.lat, point.lon]), { enabled: focused && preferences.ready && preferences.value.showWeather });
  const prayer = usePrayerTimes(location, faith.method, focused && preferences.ready && preferences.value.showPrayerTimes);
  const events = useResource(useCallback(signal => api.request('events/today', decodeEvents, { signal, params: { governorate: preferences.value.eventsGovernorate, scope: 'upcoming' } }), [preferences.value.eventsGovernorate]), { enabled: focused && preferences.ready && preferences.value.showEvents });
  const next = prayer.schedule()?.next ?? null;
  const columns = fontScale >= 1.8 ? 1 : fontScale >= 1.3 ? 2 : width >= 700 ? 6 : 3;
  const tileWidth = `${100 / columns - (columns > 1 ? 2 : 0)}%` as const;
  const perform = async (action: () => Promise<unknown>) => { setNotice(null); try { await action(); } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'تعذر إكمال الإجراء.'); } };
  function open(item: NavigationItem): void {
    void perform(() => item.external ? openExternal(item.href) : navigation.openCatalogueLink(item.href, item.id));
  }
  const groups = useMemo(() => {
    type HomeResult = SearchResult & { catalogueItem?: NavigationItem };
    const result: { title: string; items: HomeResult[] }[] = [];
    const allow = (...values: Scope[]) => values.includes(scope);
    const add = (title: string, items: HomeResult[]) => { if (items.length) result.push({ title, items }); };
    if (allow('all', 'tools')) add('الأقسام', catalogueItems.filter(item => matchesSearch(query, item.title, item.subtitle, item.href)).map(item => ({ id: item.id, title: item.title, subtitle: item.subtitle, section: item.id, params: {}, catalogueItem: item })));
    if (allow('all', 'transit')) add('مدن النقل', (cities.data ?? []).filter(city => matchesSearch(query, city.nameAr, city.name, String(city.id), 'ترانزيت سرفيس باص محافظة مدينة')).slice(0, scope === 'transit' && !query.trim() ? undefined : 8).map(city => ({ id: String(city.id), title: city.nameAr, subtitle: city.comingSoon ? 'قريباً' : 'خطوط النقل', section: 'transit', params: { cityId: String(city.id) } })));
    if (allow('all', 'muslim')) {
      add('الركن الإسلامي', [{ id: 'prayer', title: 'مواقيت الصلاة' }, { id: 'quran', title: 'قارئ القرآن' }, { id: 'radio', title: 'إذاعة القرآن' }].filter(tool => matchesSearch(query, tool.title, tool.id, 'صلاة قرآن اذاعة قبلة')).map(tool => ({ id: tool.id, title: tool.title, subtitle: '', section: `muslim_${tool.id}`, params: {} })));
      if (query.trim() || scope === 'muslim') add('سور القرآن', surahs.filter(item => matchesSearch(query, item.name, `سورة ${item.number}`, String(item.number))).slice(0, 8).map(item => ({ id: String(item.number), title: item.name, subtitle: `${item.ayahs} آية`, section: 'muslim_quran', params: { surah: String(item.number), ayah: '1' } })));
    }
    if (allow('all', 'games')) add('الألعاب', gameSearchResults(query));
    if (allow('all', 'directory') && (query.trim() || scope === 'directory')) add('المعابر', crossingData.crossings.filter(item => matchesSearch(query, item.name, item.country ?? '', item.intl)).slice(0, 8).map(item => ({ id: String(item.n), title: item.name, subtitle: item.country ?? 'ميناء بحري', section: 'crossings', params: { c: String(item.n) } })));
    if (remote.data && debounced === query.trim()) {
      if (allow('all', 'transit')) add('خطوط النقل', remote.data.routes);
      if (allow('all', 'tools', 'directory')) add('الأماكن', remote.data.places);
      if (allow('all', 'directory')) { add('دليل الهاتف', remote.data.phonebook); add('الحسابات الرسمية', remote.data.officials); }
      if (allow('all', 'tools', 'directory')) add('التطبيقات الحكومية', remote.data.govapps);
    }
    return result;
  }, [catalogueItems, cities.data, remote.data, query, debounced, scope]);
  const event = events.data?.event;
  const reload = () => { catalogue.reload(); weather.reload(); prayer.reload(); events.reload(); };
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} refreshControl={<RefreshControl refreshing={catalogue.loading && catalogue.data !== null} onRefresh={reload} tintColor={colors.accent} />}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1 }}><Label style={{ fontSize: 17, fontWeight: '600' }}>{formatGregorianSyrian(now)}</Label><Label secondary style={{ fontSize: 13, lineHeight: 20 }}>{formatHijriDate(now)}</Label></View>
      <NativeIconAction title="إعدادات الرئيسية" systemImage="slider.horizontal.3" onPress={() => setSettings(true)} />
    </View>
    {(preferences.value.showWeather || preferences.value.showPrayerTimes) ? <Section style={{ padding: 14, gap: 6 }}><Label secondary style={{ fontSize: 13, lineHeight: 18 }}>{resolvePlaceLabel(location)}</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
      {preferences.value.showWeather && weather.data ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><NativeSymbol size={18} name={weatherSymbol(weather.data.icon)} /><Label style={{ fontSize: 14, lineHeight: 22 }}>{weather.data.temp}°C · {weather.data.description}</Label></View> : null}
      {preferences.value.showPrayerTimes && next ? <Label style={{ fontSize: 14, lineHeight: 22 }}>{next.label} {next.time}</Label> : null}</View>
      {preferences.value.showWeather ? <RequestStatus resource={weather} /> : null}{preferences.value.showPrayerTimes ? <RequestStatus resource={prayer} /> : null}
    </Section> : null}
    {preferences.value.showEvents ? <><RequestStatus resource={events} />{event ? <Section style={{ padding: 14, gap: 6 }}>
      {events.data?.fallback ? <Label secondary>لا توجد فعاليات قادمة في المحافظة المختارة. نعرض فعالية من باقي المحافظات.</Label> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1 }}><Label secondary style={{ fontSize: 12, lineHeight: 18 }}>{governorates.find(row => row.f3alia_province === event.province)?.name_ar ?? event.province}</Label><Label style={{ fontWeight: '700', fontSize: 15, lineHeight: 22 }}>{event.name}</Label></View><NativeIconAction title="تفاصيل الفعالية" systemImage="arrow.up.forward" onPress={() => { void perform(() => openExternal(event.url)); }} /></View>
      <Label secondary style={{ fontSize: 13, lineHeight: 20 }}>{formatGregorianSyrianShort(event.date)} · {event.time.slice(0, 5)} · {event.free ? 'مجانية' : event.price === null ? 'تفاصيل التذاكر لدى المنظّم' : `${event.price} ل.س`}</Label><Label secondary style={{ fontSize: 13, lineHeight: 20 }}>{event.online ? 'عبر الإنترنت' : event.address}</Label>
    </Section> : !events.loading && !events.error ? <Label secondary>لا توجد فعاليات قادمة مسجلة حالياً.</Label> : null}</> : null}
    <SearchField value={query} onChange={setQuery} placeholder="ابحث في المساحة السورية" /><NativePicker<Scope> label="نطاق البحث" value={scope} options={scopes} onChange={setScope} />
    {notice || preferences.error || account.error ? <Section><Label style={{ color: colors.danger }}>{notice ?? preferences.error ?? account.error}</Label>{preferences.error ? <NativeAction title="إعادة قراءة الإعدادات" onPress={preferences.retry} /> : null}</Section> : null}
    <RequestStatus resource={catalogue} />
    {isSearching ? <View style={{ gap: 16 }}>{remote.error ? <Label secondary>تعذر تحميل نتائج الموقع. نتائج البحث المحلية متاحة.</Label> : null}
      {groups.map(group => <View key={group.title} style={{ gap: 8 }}><Label style={{ fontWeight: '700' }}>{group.title}</Label>{group.items.map(item => <Row key={item.id} title={item.title} subtitle={item.subtitle} onPress={() => {
        const entry = catalogueItems.find(candidate => candidate.id === item.section);
        if (item.url) void perform(() => openExternal(item.url ?? ''));
        else if (item.catalogueItem) open(item.catalogueItem);
        else if (entry?.external) open(entry);
        else if (entry || item.subtitle !== 'قريباً') navigation.open(item.section, item.params);
      }} />)}</View>)}{groups.length === 0 ? <EmptyState title="لا توجد نتائج" /> : null}
    </View> : <>
      {([true, false] as const).map(internal => <View key={String(internal)} style={{ gap: 16 }}>{!internal ? <Heading>روابط خارجية وشقيقة</Heading> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 }}>
          {catalogueItems.filter(item => item.isInternal === internal).map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}، ${item.subtitle}`} onPress={() => open(item)} style={({ pressed }) => ({ width: tileWidth, minHeight: 108, backgroundColor: colors.surface, borderRadius: 18, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 8, opacity: pressed ? 0.6 : 1 })}>
            <Artwork item={item} /><Label style={{ fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{item.title}</Label>{last === item.id ? <NativeSymbol name="clock.arrow.circlepath" size={14} label="آخر صفحة تمت زيارتها" /> : null}
          </Pressable>)}
        </View>
      </View>)}
    </>}
    <Section><Heading>روابط مخصصة</Heading><NativeAction title={editMode ? 'تم' : 'تعديل الروابط'} systemImage="pencil" disabled={!preferences.ready || preferences.busy} onPress={() => setEditMode(value => !value)} />
      {preferences.value.customLinks.length === 0 ? <Label secondary>لا توجد روابط مخصصة.</Label> : null}
      {preferences.value.customLinks.map(link => <View key={link.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><CustomArtwork link={link} /><View style={{ flex: 1 }}><Row title={link.name} subtitle={editMode ? 'تعديل الرابط' : new URL(link.url).hostname} onPress={() => { if (editMode) setEditor(link); else void perform(() => openExternal(link.url)); }} /></View></View>)}
      <NativeAction title="إضافة رابط" systemImage="plus" disabled={!preferences.ready || preferences.busy || preferences.value.customLinks.length >= 50} onPress={() => setEditor('new')} />
    </Section>
    <Row title={account.user?.name ?? 'تسجيل الدخول'} subtitle={account.user ? 'الحساب والإعدادات' : 'مزامنة إعداداتك مع حسابك'} symbol="person.crop.circle" onPress={() => navigation.open('account')} />
    <View style={{ gap: 8 }}>{[['about', 'عن المنصة'], ['stats', 'الإحصائيات'], ['privacy', 'سياسة الخصوصية'], ['terms', 'الشروط والأحكام']].map(([section, title]) => <Row key={section} title={title ?? ''} onPress={() => navigation.open(section ?? '')} />)}</View>
    {settings ? <HomeSettings close={() => setSettings(false)} preferences={preferences.value} save={preferences.save} disabled={!preferences.ready || preferences.busy} /> : null}
    {editor ? <LinkEditor link={editor === 'new' ? null : editor} close={() => setEditor(null)} save={link => preferences.save({ ...preferences.value, customLinks: editor === 'new' ? [...preferences.value.customLinks, link] : preferences.value.customLinks.map(item => item.id === link.id ? link : item) })} remove={id => preferences.save({ ...preferences.value, customLinks: preferences.value.customLinks.filter(item => item.id !== id) })} /> : null}
  </ScrollView>;
}
// PORT STATUS: source resources/js/Pages/Home.tsx and resources/js/Components/GlobalSearch.tsx; confidence medium; todos 3 native navigation coverage, weather artwork parity, iPhone visual and VoiceOver verification.
