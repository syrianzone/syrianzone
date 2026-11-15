import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { api, ApiError } from '../../api';
import { AdaptivePanes, contentStyle, Heading, Label, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { imageFormData, pickImage } from '../../platform/uploads';
import { assetUrl, record } from '../../platform/validation';
import { NativeAction } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { avatarBounds, confirmedAccountDelete, profileErrors } from './model';
import { SuperadminSignIn } from './SuperadminSignIn';

export function AccountScreen({ params }: FeatureScreenProps): React.JSX.Element { const account = useAccount(); return <AccountPanel key={`${account.sessionGeneration}:${params.mode ?? ''}`} superadmin={params.mode === 'superadmin'} />; }
function AccountPanel({ superadmin }: { superadmin: boolean }): React.JSX.Element {
  const account = useAccount(), navigation = useFeatureNavigation(), { colors } = useTheme();
  const [name, setName] = useState(account.user?.name ?? ''), [email, setEmail] = useState(account.user?.email ?? ''), [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Partial<Record<'name' | 'email', string>>>({}), [broken, setBroken] = useState(false), locked = useRef(false), dirty = useRef(false);
  const nameInput = useRef<React.ComponentRef<typeof TextInput>>(null), emailInput = useRef<React.ComponentRef<typeof TextInput>>(null);
  const userId = account.user?.id;
  useEffect(() => { dirty.current = false; setFields({}); setMessage(null); setError(null); setBroken(false); }, [userId]);
  useEffect(() => { if (!dirty.current) { setName(account.user?.name ?? ''); setEmail(account.user?.email ?? ''); } }, [account.user?.name, account.user?.email, userId]);
  useEffect(() => { setBroken(false); }, [account.user?.avatar_url]);
  async function perform(work: (stamp: number) => Promise<void>): Promise<void> {
    if (locked.current || account.busy) return;
    locked.current = true; setBusy(true); setMessage(null); setError(null);
    const stamp = account.sessionGeneration;
    try { await work(stamp); }
    catch (reason) {
      if (reason instanceof ApiError && reason.code === 'stale_session') return;
      if (reason instanceof ApiError && (reason.fields.name || reason.fields.email)) {
        const errors: Partial<Record<'name' | 'email', string>> = {};
        for (const key of ['name', 'email'] as const) if (reason.fields[key]?.length) errors[key] = reason.fields[key]?.find(value => /[\u0600-\u06ff]/.test(value)) ?? 'تحقق من هذه القيمة.';
        setFields(errors); if (errors.name) nameInput.current?.focus(); else emailInput.current?.focus();
      } else setError(reason instanceof Error ? reason.message : 'تعذر تحديث الحساب.');
    } finally { locked.current = false; setBusy(false); }
  }
  async function save(): Promise<void> {
    const errors = profileErrors(name, email); setFields(errors);
    if (Object.keys(errors).length) { if (errors.name) nameInput.current?.focus(); else emailInput.current?.focus(); return; }
    await perform(async stamp => {
      await api.request('account', value => { if (record(value).ok !== true) throw new Error('لم يتم تأكيد تحديث الحساب.'); }, { method: 'PATCH', authenticated: true, sessionGeneration: stamp, body: { name: name.trim(), email: email.trim() } });
      if (api.getSessionGeneration() !== stamp) return;
      try { await account.refresh(); } catch { throw new Error('حُفظت التغييرات، وتعذر تحديث بيانات الحساب المعروضة. أعد المحاولة.'); }
      dirty.current = false; setMessage('تم تحديث معلومات الحساب بنجاح.');
    });
  }
  function avatar(): void { void perform(async stamp => {
    const asset = await pickImage(avatarBounds, { allowsEditing: true, aspect: [1, 1] }); if (!asset) return;
    await api.request('account/avatar', value => { const url = assetUrl(record(value).avatar_url); if (!url) throw new Error('لم يتم تأكيد الصورة.'); return url; }, { method: 'POST', authenticated: true, sessionGeneration: stamp, body: imageFormData('avatar', asset, avatarBounds) });
    if (api.getSessionGeneration() !== stamp) return;
    try { await account.refresh(); } catch { throw new Error('رُفعت الصورة، وتعذر تحديث بيانات الحساب المعروضة. أعد المحاولة.'); }
    setMessage('تم تحديث الصورة الشخصية.');
  }); }
  function remove(): void {
    Alert.alert('حذف الحساب؟', 'سيُخفى حسابك وتُلغى رموز الدخول وتُحذف صورتك المستضافة. تبقى المساهمات العامة وقد تُنقل إلى حساب الإدارة. التنفيذ الحالي حذف منطقي، وقد يعيد تسجيل الدخول عبر Google تفعيل الحساب. لا يعني ذلك محو جميع البيانات الشخصية.', [
      { text: 'إلغاء', style: 'cancel' }, { text: 'حذف الحساب', style: 'destructive', onPress: () => { void perform(async stamp => { await api.request('account', confirmedAccountDelete, { method: 'DELETE', authenticated: true, sessionGeneration: stamp }); await account.clearDeletedSession(stamp); setMessage('تم حذف الحساب وتسجيل الخروج.'); }); } }
    ]);
  }
  const disabled = busy || account.busy || !account.ready;
  return <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"><Heading>الحساب الشخصي</Heading>
    {account.user ? <><Section><View style={{ alignItems: 'center', gap: 12 }}>{account.user.avatar_url && !broken ? <Image source={{ uri: account.user.avatar_url }} accessibilityLabel={account.user.name} contentFit="cover" onError={() => setBroken(true)} style={{ width: 80, height: 80, borderRadius: 40 }} /> : <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}><Label style={{ fontSize: 32 }}>{account.user.name.charAt(0)}</Label></View>}<NativeAction title="تغيير الصورة" systemImage="photo" disabled={disabled} onPress={avatar} /></View><Label secondary>JPG أو PNG أو WebP، حتى ٤ ميغابايت، وأبعاد بين ٦٤ و٦٠٠٠ بكسل.</Label>
      <Label>اسم المستخدم</Label><TextInput ref={nameInput} accessibilityLabel="اسم المستخدم" accessibilityHint={fields.name} autoComplete="name" textContentType="name" editable={!disabled} value={name} maxLength={255} onChangeText={value => { dirty.current = true; setName(value); }} style={{ color: colors.text, backgroundColor: colors.elevated, padding: 12, minHeight: 48, borderRadius: 12, textAlign: 'right', writingDirection: 'rtl' }} />{fields.name ? <Label style={{ color: colors.danger }}>{fields.name}</Label> : null}
      <Label>البريد الإلكتروني</Label><TextInput ref={emailInput} accessibilityLabel="البريد الإلكتروني" accessibilityHint={fields.email} autoComplete="email" textContentType="emailAddress" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!disabled} value={email} maxLength={255} onChangeText={value => { dirty.current = true; setEmail(value); }} style={{ color: colors.text, backgroundColor: colors.elevated, padding: 12, minHeight: 48, borderRadius: 12, textAlign: 'left', writingDirection: 'ltr' }} />{fields.email ? <Label style={{ color: colors.danger }}>{fields.email}</Label> : null}
      <NativeAction title={busy ? 'جارٍ التحديث' : 'حفظ التعديلات'} prominent disabled={disabled} onPress={() => { void save(); }} /><NativeAction title="تحديث بيانات الحساب" disabled={disabled} onPress={() => { void perform(async () => account.refresh()); }} /></Section>
      <NativeAction title="لوحة التحكم ومساهماتي" systemImage="rectangle.grid.2x2" onPress={() => navigation.open('dashboard')} /><NativeAction title="تسجيل الخروج" disabled={disabled} onPress={() => { void perform(async () => account.signOut()); }} />
      <Section><Label style={{ color: colors.danger, fontWeight: '700' }}>حذف الحساب</Label><Label secondary>تبقى المساهمات العامة محفوظة وفق سياسة المنصة. يمكنك مراجعة التفاصيل قبل التأكيد.</Label><NativeAction title="حذف الحساب" destructive disabled={disabled} onPress={remove} /></Section></>
      : <><Section><Label>سجّل الدخول عبر Google للوصول إلى ملفك الشخصي ومساهماتك.</Label><NativeAction title={account.ready ? 'تسجيل الدخول' : 'جارٍ استعادة الحساب'} prominent disabled={disabled} onPress={() => { void perform(async () => account.signIn()); }} /></Section><SuperadminSignIn initiallyOpen={superadmin} /></>}
    {message ? <Label style={{ color: colors.accent }}>{message}</Label> : null}{error || account.error ? <Label style={{ color: colors.danger }}>{error ?? account.error}</Label> : null}
  </ScrollView>} />;
}
export default AccountScreen;

// PORT STATUS: source resources/js/Pages/Dashboard/Index.tsx profile and AvatarUploader; confidence medium; todos 2 native avatar upload and account deletion on an isolated account. Profile persistence, picker cancellation and logout passed account-native-06.
