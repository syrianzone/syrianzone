import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Alert, FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { api, ApiError } from '../../api';
import { contentStyle, EmptyState, FormField, Heading, Label, RequestStatus, Section } from '../../components';
import { useAccount } from '../../platform/account';
import { formatGregorianSyrianShort } from '../../platform/dates';
import type { FeatureScreenProps } from '../../platform/features';
import { useFeatureNavigation } from '../../platform/features';
import { openExternal } from '../../platform/links';
import { EditorSheet } from '../../platform/Sheet';
import { imageFormData, pickImage } from '../../platform/uploads';
import { useResource } from '../../resource';
import { NativeAction, NativeIconAction, NativePicker, NativeSegmented } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import places from '../../../../resources/data/places.json';
import { placesAdminApi } from './admin-api';
import { adminPlacePatch, photoBounds, type AdminPlace, type AdminReport, type PlaceEdit } from './admin-model';
import { reportReasons } from './model';
import { PhotoViewer } from './PhotoViewer';

const statuses = [{ value: 'pending', label: 'قيد الانتظار' }, { value: 'approved', label: 'مقبول' }, { value: 'rejected', label: 'مرفوض' }, { value: 'all', label: 'الكل' }];
const reportStatuses = [{ value: 'open', label: 'مفتوحة' }, { value: 'resolved', label: 'تمت معالجتها' }, { value: 'dismissed', label: 'مرفوضة' }, { value: 'all', label: 'الكل' }];
const statusLabel = (status: string) => statuses.find(row => row.value === status)?.label ?? status;
type Run = (work: () => Promise<unknown>, feedback?: boolean) => Promise<boolean>;
function confirm(title: string, description: string, run: () => void): void {
  Alert.alert(title, description, [{ text: 'إلغاء', style: 'cancel' }, { text: 'تأكيد', style: 'destructive', onPress: run }]);
}

export function PlacesAdminScreen(props: FeatureScreenProps): React.JSX.Element {
  const account = useAccount();
  if (!account.ready) return <EmptyState title="جارٍ قراءة الحساب" />;
  if (!account.user?.effective_permissions.includes('places.review')) return <EmptyState title="لا تملك صلاحية مراجعة الأماكن" />;
  const identity = `${account.sessionGeneration}:${account.user.effective_permissions.join(',')}`;
  return <AdminBody key={identity} {...props} />;
}

function AdminBody({ params }: FeatureScreenProps): React.JSX.Element {
  const account = useAccount(), navigation = useFeatureNavigation(), { colors } = useTheme(), stamp = account.sessionGeneration;
  const can = (permission: string) => account.user?.effective_permissions.includes(permission) ?? false;
  const [tab, setTab] = useState(params.view === 'reports' ? 'reports' : 'places'), [status, setStatus] = useState('pending'), [reportStatus, setReportStatus] = useState('open'), [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [message, setMessage] = useState<string | null>(null);
  const [fields, setFields] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [reject, setReject] = useState<number | null>(null), [reason, setReason] = useState(''), [editing, setEditing] = useState<AdminPlace | null>(null);
  const locked = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const list = useResource(useCallback(signal => placesAdminApi(stamp).list(status, page, signal), [stamp, status, page]), { enabled: tab === 'places' });
  const reports = useResource(useCallback(signal => placesAdminApi(stamp).reports(reportStatus, page, signal), [stamp, reportStatus, page]), { enabled: tab === 'reports' });
  const current = tab === 'places' ? list.data : reports.data;
  useEffect(() => { if (current && current.items.length === 0 && page > current.lastPage) setPage(current.lastPage); }, [current, page]);
  const run: Run = async (work, feedback = true) => {
    if (!alive.current || locked.current || stamp !== api.getSessionGeneration()) return false;
    locked.current = true; setBusy(true); setError(null); setMessage(null); setFields({});
    try {
      const result = await work();
      if (!alive.current || stamp !== api.getSessionGeneration()) return false;
      if (result === false) return false;
      if (feedback) { setMessage('تم حفظ التغيير.'); list.reload(); reports.reload(); }
      return true;
    } catch (failure) {
      if (alive.current && stamp === api.getSessionGeneration() && !(failure instanceof ApiError && failure.code === 'stale_session')) {
        setError(failure instanceof Error ? failure.message : 'تعذر حفظ التغيير.');
        if (failure instanceof ApiError) setFields(failure.fields);
        if (failure instanceof ApiError && failure.status === 409) { list.reload(); reports.reload(); }
      }
      return false;
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const changeTab = (value: string) => { setTab(value); setPage(1); setError(null); setMessage(null); };
  return <><FlatList<AdminPlace | AdminReport> data={current?.items ?? []} keyExtractor={item => String(item.id)} contentContainerStyle={contentStyle}
    ItemSeparatorComponent={() => <View style={{ height: 14 }} />} initialNumToRender={4}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}><Heading>إدارة أماكن مشوار</Heading>
      <NativeSegmented label="أقسام الإدارة" value={tab} onChange={changeTab} disabled={busy} options={[{ value: 'places', label: 'الأماكن' }, { value: 'reports', label: 'البلاغات' }]} />
      <NativePicker label={tab === 'places' ? 'حالة المكان' : 'حالة البلاغ'} value={tab === 'places' ? status : reportStatus} disabled={busy}
        options={tab === 'places' ? statuses : reportStatuses} onChange={value => { if (tab === 'places') setStatus(value); else setReportStatus(value); setPage(1); }} />
      {current ? <Label secondary>النتائج: {current.total}</Label> : null}
      {tab === 'places' ? <RequestStatus resource={list} /> : <RequestStatus resource={reports} />}
      {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}{message ? <Label style={{ color: colors.success }}>{message}</Label> : null}
    </View>}
    ListEmptyComponent={!(tab === 'places' ? list.loading || list.error : reports.loading || reports.error) ? <EmptyState title={tab === 'places' ? 'لا توجد أماكن' : 'لا توجد بلاغات'} /> : undefined}
    renderItem={({ item }) => 'photos' in item ? <PlaceCard place={item} busy={busy} can={can} run={run} edit={() => setEditing(item)} reject={() => { setReason(''); setReject(item.id); }} />
      : <Section><NativeAction title={item.place.name} onPress={() => navigation.open('place', { id: String(item.place.id) })} />
        <Label>{statusLabel(item.place.status)}، {reportStatuses.find(row => row.value === item.status)?.label}</Label>
        <Label>{reportReasons.find(row => row.value === item.reason)?.label}</Label>{item.details ? <Label>{item.details}</Label> : null}
        <Label secondary>{item.user.name}، {formatGregorianSyrianShort(item.createdAt)}</Label>
        {item.status === 'open' && can('places.approve') ? <><NativeAction title={item.place.status === 'approved' ? 'إخفاء المكان' : 'إغلاق البلاغ'} disabled={busy} destructive onPress={() => {
          const resolve = () => { void run(() => placesAdminApi(stamp).resolve(item.id, 'unpublish')); };
          if (item.place.status === 'approved') confirm('إخفاء المكان؟', `سيُزال «${item.place.name}» من الخريطة ويعود إلى قائمة المراجعة، وتُغلق كل البلاغات المفتوحة عليه.`, resolve); else resolve();
        }} /><NativeAction title="رفض البلاغ" disabled={busy} onPress={() => { void run(() => placesAdminApi(stamp).resolve(item.id, 'dismiss')); }} /></> : null}
      </Section>}
    ListFooterComponent={current && current.lastPage > 1 ? <View style={{ gap: 10 }}><Label>{current.currentPage} / {current.lastPage}</Label><NativeAction title="السابق" disabled={busy || page <= 1} onPress={() => setPage(value => value - 1)} /><NativeAction title="التالي" disabled={busy || page >= current.lastPage} onPress={() => setPage(value => value + 1)} /></View> : undefined} />
    <EditorSheet title="رفض المكان" visible={reject !== null} close={() => { if (!busy) setReject(null); }}>
      <Label secondary>سبب الرفض يظهر للمساهم ليتمكن من التحسين.</Label><FormField label="سبب الرفض" value={reason} onChange={setReason} multiline maxLength={1000} disabled={busy} />
      {error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}<NativeAction title="تأكيد الرفض" destructive disabled={busy} onPress={() => { if (reject !== null) void run(() => placesAdminApi(stamp).reject(reject, reason)).then(saved => { if (saved) setReject(null); }); }} />
    </EditorSheet>
    {editing ? <PlaceEditor key={editing.id} place={editing} busy={busy} error={error} fields={fields} run={run} close={() => { if (!busy) setEditing(null); }} /> : null}
  </>;
}

function PlaceCard({ place, busy, can, run, edit, reject }: { place: AdminPlace; busy: boolean; can(permission: string): boolean; run: Run; edit(): void; reject(): void }): React.JSX.Element {
  const navigation = useFeatureNavigation(), account = useAccount(), { colors } = useTheme();
  const [viewer, setViewer] = useState<number | null>(null), stamp = account.sessionGeneration;
  const upload = (photoId?: number) => { void run(async () => { const image = await pickImage(photoBounds); if (!image) return false;
    const body = imageFormData('photo', image, photoBounds);
    if (photoId === undefined) await placesAdminApi(stamp).addPhoto(place.id, body); else await placesAdminApi(stamp).replacePhoto(photoId, body);
  }); };
  return <><Section><Heading>{place.name}</Heading><Label secondary>{places.categories.find(row => row.key === place.category)?.label}، {statusLabel(place.status)}</Label>
    <Label>{place.description}</Label><Label secondary>{place.user.name}، {formatGregorianSyrianShort(place.createdAt)}</Label>
    <Label secondary>{place.coordinate.latitude}, {place.coordinate.longitude}</Label>{place.rejectionReason ? <Label style={{ color: colors.danger }}>{place.rejectionReason}</Label> : null}
    <ScrollView horizontal contentContainerStyle={{ gap: 12 }}>{place.photos.map((photo, index) => <View key={photo.id} style={{ gap: 6 }}><Pressable accessibilityRole="button" accessibilityLabel={`عرض الصورة ${index + 1}`} onPress={() => setViewer(index)}><Image source={{ uri: photo.thumbnail }} style={{ width: 150, height: 120, borderRadius: 12 }} contentFit="cover" /></Pressable>
      {can('places.moderate_photos') ? <View style={{ flexDirection: 'row', gap: 4 }}><NativeIconAction title={`تدوير الصورة ${index + 1}`} systemImage="rotate.right" disabled={busy} onPress={() => { void run(() => placesAdminApi(stamp).rotatePhoto(photo.id)); }} />
        <NativeIconAction title={`استبدال الصورة ${index + 1}`} systemImage="photo.badge.plus" disabled={busy} onPress={() => upload(photo.id)} />
        {place.photos.length > 1 ? <NativeIconAction title={`حذف الصورة ${index + 1}`} systemImage="trash" disabled={busy} onPress={() => confirm('حذف هذه الصورة؟', 'لا يمكن التراجع عن الحذف.', () => { void run(() => placesAdminApi(stamp).removePhoto(photo.id)); })} /> : null}</View> : null}
    </View>)}</ScrollView>
    {can('places.edit') && place.photos.length < 10 ? <NativeAction title="إضافة صورة" systemImage="photo.badge.plus" disabled={busy} onPress={() => upload()} /> : null}
    <NativeAction title="عرض المكان" onPress={() => navigation.open('place', { id: String(place.id) })} />
    <NativeAction title="عرض الإحداثيات في OpenStreetMap" onPress={() => { void run(() => openExternal(`https://www.openstreetmap.org/?mlat=${place.coordinate.latitude}&mlon=${place.coordinate.longitude}#map=17/${place.coordinate.latitude}/${place.coordinate.longitude}`), false); }} />
    {can('places.edit') ? <NativeAction title="تعديل المكان" disabled={busy} onPress={edit} /> : null}
    {can('places.approve') && place.status === 'pending' ? <NativeAction title="قبول المكان" prominent disabled={busy} onPress={() => { void run(() => placesAdminApi(stamp).approve(place.id)); }} /> : null}
    {can('places.approve') && place.status === 'pending' ? <NativeAction title="رفض المكان" disabled={busy} onPress={reject} /> : null}
    {can('places.delete') ? <NativeAction title="حذف المكان نهائياً" destructive disabled={busy} onPress={() => confirm('حذف المكان نهائياً؟', 'سيتم حذف المكان مع جميع بياناته.', () => { void run(() => placesAdminApi(stamp).remove(place.id)); })} /> : null}
  </Section><PhotoViewer photos={place.photos.map(photo => ({ ...photo, name: place.name }))} initialIndex={viewer} close={() => setViewer(null)} /></>;
}

function PlaceEditor({ place, busy, error, fields, run, close }: {
  place: AdminPlace; busy: boolean; error: string | null; fields: Readonly<Record<string, readonly string[]>>; run: Run; close(): void;
}): React.JSX.Element {
  const stamp = useAccount().sessionGeneration, { colors } = useTheme();
  const initial: PlaceEdit = { name: place.name, category: place.category, description: place.description ?? '', lat: String(place.coordinate.latitude), lng: String(place.coordinate.longitude) };
  const [form, setForm] = useState(initial), [localError, setLocalError] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<keyof PlaceEdit, ComponentRef<typeof TextInput>>>>({});
  useEffect(() => {
    const first = (['name', 'description', 'lat', 'lng'] as const).find(key => fields[key]?.length);
    if (first) inputs.current[first]?.focus();
  }, [fields]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const dismiss = () => { if (!busy) { if (dirty) confirm('تجاهل التعديلات؟', 'لن تُحفظ التغييرات غير المرسلة.', close); else close(); } };
  const field = (key: keyof PlaceEdit, label: string, maxLength?: number) => <FormField label={label} value={form[key]} onChange={value => setForm(previous => ({ ...previous, [key]: value }))}
    disabled={busy} {...(fields[key]?.[0] ? { error: fields[key][0] } : {})} inputRef={input => { if (input) inputs.current[key] = input; else delete inputs.current[key]; }}
    {...(maxLength ? { maxLength } : {})} multiline={key === 'description'} keyboardType={key === 'lat' || key === 'lng' ? 'numbers-and-punctuation' : 'default'} />;
  return <EditorSheet title="تعديل المكان" visible close={dismiss}>{field('name', 'الاسم', 160)}
    <NativePicker label="التصنيف" value={form.category} disabled={busy} onChange={value => setForm(previous => ({ ...previous, category: value }))} options={places.categories.map(row => ({ value: row.key, label: row.label }))} />
    {fields.category?.[0] ? <Label style={{ color: colors.danger }}>{fields.category[0]}</Label> : null}
    {field('description', 'الوصف', 1000)}{field('lat', 'خط العرض')}{field('lng', 'خط الطول')}
    {localError || error ? <Label style={{ color: colors.danger }}>{localError ?? error}</Label> : null}
    <NativeAction title="حفظ التعديلات" prominent disabled={busy || !dirty} onPress={() => {
      setLocalError(null); let patch: Record<string, string | number>;
      try { patch = adminPlacePatch(place, form); } catch (failure) { setLocalError(failure instanceof Error ? failure.message : 'تحقق من القيم.'); return; }
      if (!Object.keys(patch).length) { close(); return; }
      void run(() => placesAdminApi(stamp).update(place.id, patch)).then(saved => { if (saved) close(); });
    }} />
  </EditorSheet>;
}
// PORT STATUS: source resources/js/Pages/Admin/Places/{Index,PlaceReviewCard,EditPlaceDialog,RejectDialog,ReportsTab}.tsx; confidence medium; todos 1 authenticated native moderation/photo proof on isolated data.
