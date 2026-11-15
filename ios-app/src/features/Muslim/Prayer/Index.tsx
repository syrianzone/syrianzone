import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AdaptivePanes, contentStyle, Heading, Label, RequestStatus, Section } from '../../../components';
import { useAccount } from '../../../platform/account';
import { useFaithPreferences } from '../../../platform/faith-preferences';
import { formatDuration } from '../../../platform/dates';
import { todayKey, trackedPrayers, type TrackedPrayer } from '../../../platform/faith-model';
import { resolvePlaceLabel, useLocationPreference } from '../../../platform/location';
import { usePrayerTimes } from '../../../platform/prayer';
import { prayerKeys, prayerLabels } from '../../../platform/prayer-rules';
import { NativeAction, NativeSymbol, NativeToggle, type SFSymbol } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import { PrayerSettingsSheet } from '../../../platform/PrayerSettingsSheet';

const symbols: Record<string, SFSymbol> = { Fajr: 'moon.stars', Sunrise: 'sunrise', Dhuhr: 'sun.max', Asr: 'sun.haze', Maghrib: 'sunset', Isha: 'moon' };
export function PrayerScreen(): React.JSX.Element {
  const location = useLocationPreference(), faith = useFaithPreferences(), account = useAccount();
  const prayer = usePrayerTimes(location, faith.method, faith.ready), { colors } = useTheme();
  const [settings, setSettings] = useState(false), [actionError, setActionError] = useState<string | null>(null);
  const fresh = prayer.fresh;
  const schedule = prayer.schedule();
  const done = faith.prayerLog[todayKey(prayer.now)] ?? {}, completed = trackedPrayers.filter(key => done[key]).length;
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}>
    <Heading subtitle={resolvePlaceLabel(location)}>مواقيت الصلاة</Heading>
    <NativeAction title="إعدادات المواقيت" systemImage="slider.horizontal.3" onPress={() => setSettings(true)} />
    {prayer.data?.hijri ? <Label secondary>{prayer.data.hijri.day} {prayer.data.hijri.month} {prayer.data.hijri.year} هـ</Label> : null}
    <Label>{completed}/5 صلوات منجزة اليوم</Label>
    {schedule?.next ? <Section style={{ backgroundColor: colors.accentMuted }}><Label secondary>المتبقي حتى {schedule.next.isPrayer ? 'صلاة ' : ''}{schedule.next.label}</Label>
      <Label style={{ fontSize: 32, lineHeight: 42, fontVariant: ['tabular-nums'], textAlign: 'center' }}>{formatDuration(schedule.next.remainingMs)}</Label></Section> : null}
    <RequestStatus resource={prayer} />
    {prayer.data && !fresh ? <Label secondary>آخر مواقيت محفوظة بتاريخ {prayer.cachedDay}. اتصل بالإنترنت لتحديث مواقيت اليوم.</Label> : null}
    {prayer.data ? prayerKeys.map(key => {
      const active = schedule?.active?.key === key, next = schedule?.next?.key === key;
      return <Section key={key} style={{ backgroundColor: active || next ? colors.accentMuted : colors.surface }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><NativeSymbol name={symbols[key] ?? 'clock'} />
            <Label style={{ fontWeight: '600' }}>{prayerLabels[key]}{active ? '، الآن' : ''}</Label></View>
          <Label style={{ fontVariant: ['tabular-nums'] }}>{prayer.data?.timings[key]}</Label>
        </View>
        {key !== 'Sunrise' ? <NativeToggle title={`تمت صلاة ${prayerLabels[key]}`} value={done[key as TrackedPrayer] ?? false} onChange={() => {
          void faith.togglePrayer(key as TrackedPrayer).catch(reason => setActionError(reason instanceof Error ? reason.message : 'تعذر حفظ السجل.'));
        }} /> : null}
      </Section>;
    }) : null}
    {faith.error || actionError ? <Section><Label style={{ color: colors.danger }}>{actionError ?? faith.error}</Label><NativeAction title="إعادة المحاولة" onPress={() => { setActionError(null); faith.retry(); }} /></Section> : null}
    {!account.user ? <Section><Label secondary>سجل الصلوات محفوظ على هذا الجهاز. سجّل الدخول لمزامنته مع حسابك.</Label>
      <NativeAction title="تسجيل الدخول" onPress={() => { void account.signIn().catch(reason => setActionError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول.')); }} /></Section> : null}
    <Label secondary>المواقيت والعد التنازلي بتوقيت الموقع المختار. يرتبط سجل الإنجاز بيوم دمشق. قارن طريقة الحساب مع مسجدك.</Label>
    <PrayerSettingsSheet visible={settings} onClose={() => setSettings(false)} />
  </ScrollView>} />;
}
export default PrayerScreen;

// PORT STATUS: source resources/js/Pages/Muslim/_components/PrayerView.tsx; confidence medium; todos 1 iPhone interaction and layout verification.
