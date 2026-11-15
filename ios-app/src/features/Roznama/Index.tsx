import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, Heading, Label, RequestStatus, Section } from '../../components';
import { useForegroundClock } from '../../platform/clock';
import { decodeEvents, decodeWeather } from '../../platform/conditions';
import { formatDuration, formatGregorianSyrian, formatGregorianSyrianShort, formatHijriDate, hijriDateLabel } from '../../platform/dates';
import { useFaithPreferences } from '../../platform/faith-preferences';
import { todayKey } from '../../platform/faith-model';
import { openExternal } from '../../platform/links';
import { resolvePlaceLabel, resolveWeatherPoint, useLocationPreference } from '../../platform/location';
import { usePrayerTimes } from '../../platform/prayer';
import { prayerKeys, prayerLabels, methods } from '../../platform/prayer-rules';
import { readDocument, writeDocument } from '../../platform/storage';
import { useResource } from '../../resource';
import { NativeAction, NativeSymbol, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { PrayerSettingsSheet } from '../../platform/PrayerSettingsSheet';
import { daysUntil, holidaysForYear, nextHoliday } from './holidays';

export function RoznamaScreen(): React.JSX.Element {
  const location = useLocationPreference(), faith = useFaithPreferences(), now = useForegroundClock(), { colors } = useTheme();
  const [settings, setSettings] = useState(false), [allEvents, setAllEvents] = useState(false), [hidePassed, setHidePassed] = useState(false), [ready, setReady] = useState(false), [error, setError] = useState<string | null>(null);
  const [preferenceAttempt, setPreferenceAttempt] = useState(0);
  const point = resolveWeatherPoint(location), today = todayKey(now), year = Number(today.slice(0, 4));
  const weather = useResource(useCallback(signal => api.request('weather', decodeWeather, { signal, params: { lat: point.lat, lon: point.lon } }), [point.lat, point.lon]));
  const events = useResource(useCallback(signal => api.request('events/today', decodeEvents, { signal, params: { governorate: allEvents ? 'all' : location.city } }), [allEvents, location.city]));
  const prayer = usePrayerTimes(location, faith.method, faith.ready), schedule = prayer.schedule();
  const holidays = useMemo(() => holidaysForYear(year), [year]), next = nextHoliday(today), visible = hidePassed ? holidays.filter(row => row.day >= today) : holidays;
  const upcoming = events.data?.events.filter(row => row.date >= today).sort((a, b) => a.date.localeCompare(b.date)) ?? [];
  useEffect(() => { let active = true; void readDocument('syrian-zone.roznama.v1', value => { if (typeof value !== 'boolean') throw new Error('تفضيل الروزنامة غير صالح.'); return value; }, false)
    .then(value => { if (active) { setHidePassed(value); setReady(true); setError(null); } }).catch(() => { if (active) setError('تعذر قراءة تفضيل الروزنامة المحفوظ.'); }); return () => { active = false; }; }, [preferenceAttempt]);
  function toggleHide(value: boolean): void { void writeDocument('syrian-zone.roznama.v1', value).then(() => { setHidePassed(value); setError(null); }).catch(() => setError('تعذر حفظ تفضيل الروزنامة.')); }
  function visit(url: string): void { void openExternal(url).catch(() => setError('تعذر فتح رابط الفعالية.')); }
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>
    <Heading subtitle={resolvePlaceLabel(location)}>الروزنامة السورية</Heading><NativeAction title="إعدادات الموقع والصلاة" systemImage="slider.horizontal.3" onPress={() => setSettings(true)} />
    <Section><NativeSymbol name="clock" size={38} /><Label style={{ fontSize: 34, lineHeight: 45, fontVariant: ['tabular-nums'] }}>{now.toLocaleTimeString('en-US', { hour12: false })}</Label>
      <Label>{formatGregorianSyrian(now)}</Label><Label secondary>{hijriDateLabel(prayer.data?.hijri ?? null) ?? formatHijriDate(now)}</Label>
      {weather.data ? <Label>{weather.data.temp}°C، {weather.data.description}</Label> : null}<RequestStatus resource={weather} /></Section>
    {next ? <Section style={{ backgroundColor: colors.accentMuted }}><Label style={{ fontWeight: '700' }}>{daysUntil(next.day, today) === 0 ? 'عطلة اليوم' : 'العطلة القادمة'}</Label><Heading subtitle={`${formatGregorianSyrianShort(`${next.day}T12:00:00`)}، بعد ${daysUntil(next.day, today)} يوم`}>{next.nameAr}</Heading><Label>{next.description}</Label></Section> : null}
    <Section><Heading>مواقيت الصلاة</Heading><RequestStatus resource={prayer} />
      {schedule?.next ? <Label style={{ color: colors.accent }}>الصلاة القادمة: {schedule.next.label}، متبقي {formatDuration(schedule.next.remainingMs)}</Label> : null}
      {prayerKeys.map(key => <View key={key} style={{ flexDirection: 'row', gap: 12, padding: 10, borderRadius: 12, backgroundColor: schedule?.active?.key === key ? colors.accentMuted : 'transparent' }}><Label style={{ flex: 1 }}>{prayerLabels[key]}</Label><Label>{prayer.data?.timings[key] ?? '...'}</Label></View>)}
      <Label secondary>طريقة الحساب: {methods.find(row => row.id === faith.method)?.nameAr ?? String(faith.method)}</Label>
      {prayer.cachedDay && !prayer.fresh ? <Label secondary>آخر مواقيت محفوظة بتاريخ {prayer.cachedDay}. حدّثها قبل الاعتماد عليها.</Label> : null}</Section>
    <Section><Heading>العطلات والمناسبات</Heading>{ready ? <NativeToggle title="إخفاء المناسبات الماضية" value={hidePassed} onChange={toggleHide} /> : null}
      {visible.map(row => <View key={row.nameEn} style={{ gap: 4, paddingVertical: 10, borderBottomColor: colors.separator, borderBottomWidth: 0.5 }}><Label style={{ fontWeight: '700' }}>{row.nameAr}{row.isNew ? '، عيد وطني جديد' : ''}</Label><Label secondary>{formatGregorianSyrianShort(`${row.day}T12:00:00`)}</Label><Label>{row.description}</Label></View>)}
      <Label secondary>التواريخ الدينية تقديرية وتخضع للإعلان الرسمي. جدول التواريخ المتغيرة متاح لعامي ٢٠٢٦ و٢٠٢٧.</Label></Section>
    <Section><Heading>الفعاليات القادمة</Heading><NativeToggle title="عرض باقي المحافظات" value={allEvents} onChange={setAllEvents} /><RequestStatus resource={events} />
      {events.data?.fallback ? <Label secondary>تُعرض فعاليات من محافظات أخرى لعدم توفر فعاليات محلية.</Label> : null}
      {events.data && upcoming.length === 0 ? <Label secondary>لا توجد فعاليات قادمة متاحة حالياً.</Label> : null}
      {upcoming.map(event => <Section key={event.id} style={{ backgroundColor: colors.elevated }}><Label style={{ fontWeight: '700' }}>{event.name}</Label><Label secondary>{formatGregorianSyrianShort(`${event.date}T12:00:00`)} {event.time}، {event.provinceName}</Label><Label>{event.description}</Label>
        <Label secondary>{event.online ? 'عبر الإنترنت' : event.address}، {event.free ? 'مجانية' : event.price !== null ? `${event.price} ل.س` : 'مدفوعة'}{event.category ? `، ${event.category}` : ''}</Label>{event.organizer ? <Label secondary>{event.organizer}</Label> : null}<NativeAction title="تفاصيل الفعالية" systemImage="arrow.up.right" onPress={() => visit(event.url)} /></Section>)}</Section>
    {error ? <Section><Label style={{ color: colors.danger }}>{error}</Label>{!ready ? <NativeAction title="إعادة قراءة التفضيل المحفوظ" onPress={() => setPreferenceAttempt(value => value + 1)} /> : null}</Section> : null}<PrayerSettingsSheet visible={settings} onClose={() => setSettings(false)} />
  </ScrollView>} />;
}
export default RoznamaScreen;

// PORT STATUS: source resources/js/Pages/Roznama/Index.tsx; confidence medium; todos 1 native calendar layout and storage error recovery verification.
