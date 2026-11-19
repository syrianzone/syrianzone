import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import prayer from '../../../resources/data/prayer.json';
import { Label } from '../components';
import { NativeAction, NativePicker } from '../ui/native';
import { useTheme } from '../ui/theme';
import { useAccount } from './account';
import { useFaithPreferences } from './faith-preferences';
import { accountPatchForLocation, governorates, initializeLocationPreference, resolveGps, resolveIp, resolvePlaceLabel, updateLocationPreference, useLocationPreference, useLocationStatus, type LocMode, type LocationPatch } from './location';

export function PrayerSettingsFields({ showMethod = true }: { showMethod?: boolean }): React.JSX.Element {
  const location = useLocationPreference(), status = useLocationStatus(), faith = useFaithPreferences(), account = useAccount();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef<Record<string, unknown>>({}), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const owner = useRef<number | null>(account.user?.id ?? null), mounted = useRef(true);
  const currentUser = useRef(account.user?.id ?? null);
  useLayoutEffect(() => { currentUser.current = account.user?.id ?? null; }, [account.user?.id]);
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!Object.keys(pending.current).length || owner.current === null || owner.current !== currentUser.current) return;
    const patch = pending.current; pending.current = {};
    try { await account.saveSettings(patch); }
    catch {
      if (owner.current === currentUser.current) pending.current = { ...patch, ...pending.current };
      if (mounted.current) setError('حُفظ الموقع على الجهاز وتعذرت مزامنته مع الحساب. أعد المحاولة.');
    }
  }, [account]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; void flush(); };
  }, [flush]);
  async function apply(patch: LocationPatch): Promise<void> {
    try {
      await updateLocationPreference(patch);
      setError(null);
      if (!account.user) return;
      const mirrored = accountPatchForLocation(patch);
      // Both legacy account channels describe the same selected manual location.
      if ('governorate' in mirrored) mirrored.muslimCity = mirrored.governorate;
      if ('useCustomCoords' in mirrored) mirrored.muslimUseCustomCoords = mirrored.useCustomCoords;
      if ('customLat' in mirrored) mirrored.muslimLat = mirrored.customLat;
      if ('customLon' in mirrored) mirrored.muslimLon = mirrored.customLon;
      owner.current = account.user.id;
      pending.current = { ...pending.current, ...mirrored };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { void flush(); }, 500);
    } catch { setError('تعذر حفظ الموقع. حاول مجدداً.'); }
  }
  async function select(mode: LocMode): Promise<void> {
    if (busy) return;
    if (mode === 'city' || mode === 'custom') { await apply({ mode, useCustomCoords: mode === 'custom' }); return; }
    setBusy(true); setError(null);
    try { const geo = mode === 'gps' ? await resolveGps() : await resolveIp(); await apply({ mode, geo, useCustomCoords: false }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذر تحديد الموقع.'); }
    finally { setBusy(false); }
  }
  const fields = [{ key: 'customLat', label: 'خط العرض', value: location.customLat }, { key: 'customLon', label: 'خط الطول', value: location.customLon }] as const;
  const options = prayer.methods.map(method => ({ value: String(method.id), label: method.name_ar }));
  if (!options.some(option => option.value === String(faith.method))) options.push({ value: String(faith.method), label: `الطريقة المحفوظة (${faith.method})` });
  return <View style={{ gap: 14 }}>
    <NativePicker label="مصدر الموقع" value={location.mode} disabled={busy || !status.ready} onChange={mode => { void select(mode); }} options={[
      { value: 'gps', label: 'موقع الجهاز (GPS)' }, { value: 'ip', label: 'التعرف عبر الإنترنت' }, { value: 'city', label: 'مدينة يدوية' }, { value: 'custom', label: 'إحداثيات يدوية' }
    ]} />
    <Label secondary>{resolvePlaceLabel(location)}</Label>
    {location.mode === 'gps' || location.mode === 'ip' ? <><NativeAction title={busy ? 'جارٍ تحديد الموقع' : 'تحديث الموقع'} disabled={busy} systemImage="location" onPress={() => { void select(location.mode); }} />
      {location.geo ? <Label secondary>{location.geo.lat}، {location.geo.lon}</Label> : null}</> : null}
    {location.mode === 'city' ? <NativePicker label="المدينة" value={location.city} disabled={!status.ready} options={governorates.map(city => ({ value: city.id, label: city.nameAr }))} onChange={city => { void apply({ city }); }} /> : null}
    {location.mode === 'custom' ? fields.map(field => <View key={field.key} style={{ gap: 4 }}><Label>{field.label}</Label>
      <TextInput accessibilityLabel={field.label} value={field.value} editable={status.ready} keyboardType="numbers-and-punctuation" autoCorrect={false} returnKeyType="done"
        onChangeText={value => { void apply({ [field.key]: value }); }} onEndEditing={() => { void flush(); }}
        style={{ color: colors.text, backgroundColor: colors.elevated, borderRadius: 12, padding: 12, minHeight: 48, fontSize: 17, textAlign: 'left', writingDirection: 'ltr' }} /></View>) : null}
    {showMethod ? <><NativePicker label="طريقة الحساب" value={String(faith.method)} disabled={!faith.ready} options={options}
      onChange={value => { void faith.setPreferences({ method: Number(value) }).catch(reason => setError(reason instanceof Error ? reason.message : 'تعذر حفظ الطريقة.')); }} />
      <Label secondary>{prayer.methods.find(method => method.id === faith.method)?.detail ?? 'تُستخدم طريقة الحساب المحفوظة في حسابك.'}</Label></> : null}
    {showMethod && faith.methodConflict ? <View style={{ gap: 8 }}><Label>طريقة الحساب على الجهاز تختلف عن الحساب. اختر النسخة التي تريدها.</Label>
      <NativeAction title="استخدم إعداد الجهاز" onPress={() => { void faith.resolveMethodConflict('local').catch(() => setError('تعذر حفظ الاختيار.')); }} />
      <NativeAction title="استخدم إعداد الحساب" onPress={() => { void faith.resolveMethodConflict('account').catch(() => setError('تعذر حفظ الاختيار.')); }} /></View> : null}
    {error || status.error || (showMethod && faith.error) ? <><Label style={{ color: colors.danger }}>{error ?? status.error ?? faith.error}</Label>
      <NativeAction title="إعادة المحاولة" onPress={() => { faith.retry(); void initializeLocationPreference().catch(() => undefined); void flush(); }} /></> : null}
  </View>;
}

// PORT STATUS: source resources/js/Domain/prayer/PrayerSettingsFields.tsx; confidence medium; todos 0.
