import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Alert, Modal, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../api';
import { contentStyle, FormField, Heading, Label, Photo, RequestStatus, Section } from '../../components';
import { placeCategories, type Coordinate } from '../../domain';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAccount } from '../../platform/account';
import { useResource } from '../../resource';
import { placesClient } from './api';
import { ContributionPhotos } from './PhotoPicker';
import { contributionFieldErrors, type PickedPhoto } from './model';

export function ContributionSheet({ point, close, submitted, selectExisting }: { point: Coordinate | null; close(): void; submitted(id: number): void; selectExisting(id: number): void }): React.JSX.Element {
  const account = useAccount(), { colors } = useTheme();
  const [step, setStep] = useState<'auth' | 'duplicates' | 'form' | 'done'>('auth');
  const [name, setName] = useState(''), [category, setCategory] = useState(''), [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]), [error, setError] = useState<string | null>(null), [fields, setFields] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [busy, setBusy] = useState(false), [ownerSession, setOwnerSession] = useState<number | null>(null), [resultId, setResultId] = useState<number | null>(null);
  const working = useRef(false);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), nameInput = useRef<ComponentRef<typeof TextInput>>(null), descriptionInput = useRef<ComponentRef<typeof TextInput>>(null);
  const categoryGroup = useRef<ComponentRef<typeof View>>(null), coordinateGroup = useRef<ComponentRef<typeof View>>(null), photoGroup = useRef<ComponentRef<typeof View>>(null);
  const authGeneration = account.user ? account.sessionGeneration : undefined;
  const duplicates = useResource(useCallback((signal: AbortSignal) => point ? placesClient.nearby(point, signal, authGeneration) : Promise.resolve([]), [point, authGeneration]), { enabled: point !== null && step === 'duplicates' && account.user !== null && !account.busy });
  useEffect(() => { if (!point) return; setName(''); setCategory(''); setDescription(''); setPhotos([]); setError(null); setFields({}); setBusy(false); setResultId(null); setOwnerSession(null); setStep('auth'); }, [point]);
  useEffect(() => { if (point && account.user && step === 'auth' && !account.busy) { setOwnerSession(account.sessionGeneration); setStep('duplicates'); } }, [point, account.user, account.sessionGeneration, account.busy, step]);
  useEffect(() => { if (step === 'duplicates' && !duplicates.loading && (duplicates.error || duplicates.data?.length === 0)) setStep('form'); }, [step, duplicates.loading, duplicates.error, duplicates.data]);
  useEffect(() => {
    const first = ['name', 'category', 'description', 'lat', 'lng', 'photos'].find(key => Object.keys(fields).some(fieldKey => fieldKey === key || fieldKey.startsWith(`${key}.`)));
    if (!first || !point) return;
    const frame = requestAnimationFrame(() => {
      const target = first === 'name' ? nameInput.current : first === 'description' ? descriptionInput.current : first === 'category' ? categoryGroup.current : first === 'photos' ? photoGroup.current : coordinateGroup.current;
      if (!target) return;
      if (first === 'name') nameInput.current?.focus(); else if (first === 'description') descriptionInput.current?.focus();
      else AccessibilityInfo.announceForAccessibility(Object.entries(fields).filter(([key]) => key === first || key.startsWith(`${first}.`)).flatMap(([, messages]) => messages).join(' '));
      const inner = scroll.current?.getInnerViewRef();
      if (inner) target.measureLayout(inner, (_x, y) => scroll.current?.scrollTo({ y: Math.max(0, y - 16), animated: true }), () => undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [fields, point]);
  const dirty = Boolean(name.trim() || category || description.trim() || photos.length);
  const finish = (): void => { if (resultId !== null) submitted(resultId); close(); };
  const requestClose = (): void => {
    if (busy) return;
    if (step === 'form' && dirty) Alert.alert('إغلاق دون إرسال؟', 'سيتم تجاهل ما أدخلته.', [{ text: 'متابعة', style: 'cancel' }, { text: 'تجاهل وإغلاق', style: 'destructive', onPress: close }]);
    else if (step === 'done') finish(); else close();
  };
  const field = (key: string): React.JSX.Element | null => { const values = Object.entries(fields).filter(([nameKey]) => nameKey === key || nameKey.startsWith(`${key}.`)).flatMap(([, messages]) => messages); return values.length ? <Label style={{ color: colors.danger }}>{values.join('\n')}</Label> : null; };
  async function send(): Promise<void> {
    if (!point || working.current || !account.user || account.busy) return;
    if (ownerSession !== account.sessionGeneration) { setError('تغيّر الحساب. راجع هوية المساهمة قبل الإرسال.'); return; }
    const validation = contributionFieldErrors({ name, category, description, coordinate: point, photos });
    if (Object.keys(validation).length) { setFields(validation); setError('تحقق من الحقول المحددة.'); return; }
    const generation = ownerSession;
    working.current = true; setBusy(true); setError(null); setFields({});
    try { const id = await placesClient.submit({ name, category, description, coordinate: point, photos }, generation); setResultId(id); setStep('done'); }
    catch (reason) { if (reason instanceof ApiError) setFields(reason.fields); setError(reason instanceof Error ? reason.message : 'تعذر إرسال المكان.'); }
    finally { working.current = false; setBusy(false); }
  }
  return <Modal visible={point !== null} presentationStyle="pageSheet" onRequestClose={requestClose}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView ref={scroll} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} keyboardDismissMode="interactive"><NativeAction title="إغلاق" disabled={busy} onPress={requestClose} /><Heading subtitle="تُراجع الأماكن قبل ظهورها على الخريطة.">إضافة مكان</Heading>
    {step === 'auth' ? <Section><Label>سجّل الدخول لتتمكن من إضافة الأماكن.</Label><NativeAction title="تسجيل الدخول عبر جوجل" disabled={!account.ready || account.busy} onPress={() => { setError(null); void account.signIn().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذر تسجيل الدخول.')); }} /></Section> : null}
    {step === 'duplicates' ? <><RequestStatus resource={duplicates} />{duplicates.data?.length ? <Section><Label>يوجد أماكن قريبة من النقطة المحددة. إن كان مكانك مختلفاً يمكنك إضافته.</Label>{duplicates.data.map(place => <View key={place.id} style={{ gap: 8 }}><Photo url={place.thumbnail} label={place.name} height={120} /><Label>{place.name} · {place.distance} م</Label><NativeAction title="هذا هو المكان" onPress={() => { selectExisting(place.id); close(); }} /></View>)}<NativeAction title="متابعة الإضافة على أي حال" onPress={() => setStep('form')} /></Section> : null}</> : null}
    {step === 'form' ? <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 12 }}><Label secondary>بمساهمة {account.user?.name ?? 'حساب غير متاح'}</Label>{ownerSession !== account.sessionGeneration ? <Section><Label>تغيّر الحساب. لن تُرسل هذه المساهمة قبل مراجعتك.</Label><NativeAction title="المتابعة بالحساب الحالي" disabled={!account.user || account.busy} onPress={() => { setOwnerSession(account.sessionGeneration); setStep('duplicates'); setError(null); }} /></Section> : null}
      <FormField label="اسم المكان" value={name} onChange={setName} autoCorrect={false} maxLength={160} inputRef={nameInput} {...(fields.name?.length ? { error: fields.name.join('\n') } : {})} /><View ref={categoryGroup} collapsable={false}><NativePicker label="التصنيف" value={category} onChange={setCategory} options={[{ value: '', label: 'اختر التصنيف' }, ...placeCategories.map(item => ({ value: item.key, label: item.label }))]} />{field('category')}</View><FormField label="الوصف (20 إلى 1000 حرف)" value={description} onChange={setDescription} multiline maxLength={1000} inputRef={descriptionInput} {...(fields.description?.length ? { error: fields.description.join('\n') } : {})} /><Label secondary>{description.length} / 1000</Label><View ref={coordinateGroup} collapsable={false}><Label style={{ writingDirection: 'ltr', textAlign: 'right' }}>{point?.latitude.toFixed(5)}, {point?.longitude.toFixed(5)}</Label>{field('lat')}{field('lng')}</View><View ref={photoGroup} collapsable={false}><ContributionPhotos photos={photos} change={setPhotos} disabled={busy || account.busy || ownerSession !== account.sessionGeneration} />{field('photos')}</View><NativeAction title={busy ? 'جارٍ إرسال المكان' : 'إرسال المكان'} disabled={busy || !account.user || account.busy || ownerSession !== account.sessionGeneration} prominent onPress={() => { void send(); }} />
    </View> : null}
    {step === 'done' ? <Section><Label>تم إرسال المكان وسيظهر على الخريطة بعد الموافقة.</Label><Label secondary>رقم المساهمة: {resultId}</Label><NativeAction title="إغلاق" onPress={finish} /></Section> : null}
    {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
  </ScrollView></SafeAreaView></Modal>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/SubmitSheet.tsx and DuplicateSuggestions.tsx; confidence medium; todos 1 isolated authenticated submit, native field focus and discard verification.
