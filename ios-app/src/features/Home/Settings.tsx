import { useState } from 'react';
import { Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { contentStyle, Heading, Label, Section } from '../../components';
import { NativeAction, NativePicker, NativeSegmented, NativeToggle } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAppState } from '../../state';
import { useAccount } from '../../platform/account';
import { PrayerSettingsFields } from '../../platform/PrayerSettingsFields';
import { governorates } from '../../platform/location-model';
import type { HomePreferences } from './model';

export function HomeSettings({ close, preferences, save, disabled }: { close(): void; preferences: HomePreferences; save(value: HomePreferences): Promise<void>; disabled: boolean }): React.JSX.Element {
  const { colors, mode } = useTheme();
  const state = useAppState(), account = useAccount();
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const perform = async (action: () => Promise<unknown>) => { setBusy(true); setError(null); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر حفظ الإعداد.'); } finally { setBusy(false); } };
  return <Modal visible presentationStyle="pageSheet" onRequestClose={close}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <NativeAction title="تم" onPress={close} /><Heading>إعدادات الرئيسية</Heading>
      {error || state.error ? <Label style={{ color: colors.danger }}>{error ?? state.error}</Label> : null}
      <Section><Label style={{ fontWeight: '700' }}>المظهر</Label><NativeSegmented label="المظهر" value={mode} disabled={busy || state.busy || !state.storageAvailable} options={[{ value: 'light', label: 'فاتح' }, { value: 'dark', label: 'داكن' }]} onChange={value => { void perform(async () => { if (!(await state.setAppearance(value))) throw new Error('تعذر حفظ المظهر على الجهاز. حاول مجدداً.'); if (account.user) await account.saveSettings({ theme: value }); }); }} /></Section>
      <Section><Label style={{ fontWeight: '700' }}>ما يظهر في الرئيسية</Label>
        {([['showWeather', 'الطقس'], ['showPrayerTimes', 'الصلاة القادمة'], ['showEvents', 'الفعاليات القادمة']] as const).map(([key, title]) => <NativeToggle key={key} disabled={disabled || busy} title={title} value={preferences[key]} onChange={value => { void perform(() => save({ ...preferences, [key]: value })); }} />)}
        <NativePicker label="محافظة الفعاليات" value={preferences.eventsGovernorate} disabled={disabled || busy} options={[{ value: 'all', label: 'كل المحافظات' }, ...governorates.map(row => ({ value: row.id, label: row.nameAr }))]} onChange={value => { void perform(() => save({ ...preferences, eventsGovernorate: value })); }} />
      </Section>
      <Section><PrayerSettingsFields showMethod={false} /></Section>
    </ScrollView>
  </SafeAreaView></Modal>;
}
// PORT STATUS: source resources/js/Pages/Home/_components/HomeSettingsDialog.tsx; confidence medium; todos 1 on-device sheet and location verification.
