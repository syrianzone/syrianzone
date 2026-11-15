import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '../../api';
import { contentStyle, FormField, Heading, Label, Photo, RequestStatus, Section } from '../../components';
import { placeCategories } from '../../domain';
import { useResource } from '../../resource';
import { useAccount } from '../../platform/account';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { placesClient } from './api';
import { inSyria, parseCoordinates, type FullPlace, type OwnPlace, type PlacePhoto, type PlaceStatus } from './model';
import { pickNativePhotos } from './PhotoPicker';

export const placeStatusLabels: Record<PlaceStatus, string> = { pending: 'قيد المراجعة', approved: 'مقبول', rejected: 'مرفوض' };
export function ManagePlace({ place, close, updated }: { place: OwnPlace; close(): void; updated(): void }): React.JSX.Element {
  const account = useAccount(), { colors } = useTheme();
  const [origin] = useState(account.sessionGeneration);
  const current = origin === account.sessionGeneration && account.user !== null && !account.busy;
  const resource = useResource(useCallback((signal: AbortSignal) => placesClient.detail(place.id, signal, origin), [place.id, origin]), { enabled: current });
  const [original, setOriginal] = useState<FullPlace | null>(null), [name, setName] = useState(''), [category, setCategory] = useState(''), [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState(`${place.coordinate.latitude.toFixed(5)}, ${place.coordinate.longitude.toFixed(5)}`);
  const [photos, setPhotos] = useState<PlacePhoto[]>([]), [status, setStatus] = useState(place.status), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null);
  const working = useRef(false);
  useEffect(() => { const detail = resource.data; if (detail) { setOriginal(detail); setName(detail.name); setCategory(detail.category); setDescription(detail.description ?? ''); setPhotos(detail.photos); setStatus(detail.status); } }, [resource.data]);
  const changes: Partial<{ name: string; category: string; description: string }> = {};
  if (original) { if (name.trim() !== original.name) changes.name = name; if (category !== original.category) changes.category = category; if (description.trim() !== original.description) changes.description = description; }
  const point = parseCoordinates(coordinates), validPoint = point !== null && inSyria(point);
  const dirty = Boolean(Object.keys(changes).length);
  const requestClose = (): void => { if (busy) return; if (dirty) Alert.alert('إغلاق دون حفظ؟', 'سيتم تجاهل تعديلات النص.', [{ text: 'متابعة', style: 'cancel' }, { text: 'تجاهل وإغلاق', style: 'destructive', onPress: close }]); else close(); };
  async function perform(action: () => Promise<void>): Promise<void> {
    if (working.current || !current) return;
    working.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (reason) { const fields = reason instanceof ApiError ? Object.values(reason.fields).flat() : []; setError(fields.length ? fields.join('\n') : reason instanceof Error ? reason.message : 'تعذر حفظ التغيير.'); }
    finally { working.current = false; setBusy(false); }
  }
  const pending = (): void => { setStatus('pending'); updated(); setNotice('حُفظ التغيير وأُعيد المكان للمراجعة.'); };
  const removePlace = (): void => Alert.alert('حذف المكان؟', 'سيُحذف المكان وصوره. لا يمكن التراجع عن هذا الإجراء.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { void perform(async () => { await placesClient.remove(place.id, origin); updated(); close(); }); } }]);
  const removePhoto = (photo: PlacePhoto): void => Alert.alert('حذف الصورة؟', 'سيعود المكان للمراجعة بعد حذف الصورة.', [{ text: 'إلغاء', style: 'cancel' }, { text: 'حذف', style: 'destructive', onPress: () => { void perform(async () => { await placesClient.removePhoto(photo.id, origin); setPhotos(previous => previous.filter(item => item.id !== photo.id)); pending(); }); } }]);
  return <Modal visible presentationStyle="pageSheet" onRequestClose={requestClose}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={contentStyle} automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive"><NativeAction title="إغلاق" disabled={busy} onPress={requestClose} /><Heading subtitle={placeStatusLabels[status]}>إدارة المكان</Heading>{current ? <RequestStatus resource={resource} /> : <Label>تغيّر الحساب. أغلق هذه النافذة ثم افتح المساهمة بالحساب الصحيح.</Label>}
    {current && original ? <><Section><FormField label="اسم المكان" value={name} onChange={setName} maxLength={160} /><NativePicker label="التصنيف" value={category} onChange={setCategory} disabled={busy} options={placeCategories.map(item => ({ value: item.key, label: item.label }))} /><FormField label="الوصف" value={description} onChange={setDescription} multiline maxLength={1000} /><Label secondary>تعديل البيانات يعيد المكان للمراجعة.</Label><NativeAction title="حفظ البيانات" disabled={busy || !dirty} onPress={() => { void perform(async () => { await placesClient.update(place.id, changes, origin); setOriginal(previous => previous ? { ...previous, name: name.trim(), category, description: description.trim() } : null); pending(); }); }} /></Section>
      <Section><Heading>الموقع</Heading><FormField label="إحداثيات المكان" value={coordinates} onChange={setCoordinates} />{point ? <Label secondary>{validPoint ? 'إحداثيات صحيحة داخل سوريا.' : 'النقطة خارج حدود سوريا.'}</Label> : <Label secondary>أدخل إحداثيات صحيحة، مثال: 34.7, 36.6</Label>}<Label secondary>نقل الموقع يعيد المكان للمراجعة.</Label><NativeAction title="حفظ الموقع" disabled={busy || !validPoint} onPress={() => { if (point) void perform(async () => { await placesClient.move(place.id, point, origin); pending(); }); }} /></Section>
      <Section><Heading>الصور</Heading>{photos.map(photo => <View key={photo.id} style={{ gap: 8 }}><Photo url={photo.url} label={name} height={220} /><NativeAction title="تدوير الصورة" disabled={busy} systemImage="rotate.right" onPress={() => { void perform(async () => { const next = await placesClient.rotatePhoto(photo.id, origin); setPhotos(previous => previous.map(item => item.id === photo.id ? { ...item, ...next } : item)); updated(); setNotice('تم تدوير الصورة. حالة المراجعة لم تتغير.'); }); }} /><NativeAction title="حذف الصورة" destructive disabled={busy || photos.length <= 1} onPress={() => removePhoto(photo)} /></View>)}{photos.length < 10 ? <NativeAction title="إضافة صورة" disabled={busy} onPress={() => { void perform(async () => { const picked = await pickNativePhotos(1); const photo = picked[0]; if (!photo) return; const next = await placesClient.addPhoto(place.id, photo, origin); setPhotos(previous => [...previous, next]); pending(); }); }} /> : null}<Label secondary>حتى عشر صور. الإضافة والحذف يعيدان المكان للمراجعة، والتدوير يحافظ على حالته.</Label></Section>
      {status === 'rejected' ? <Section>{place.rejectionReason ? <Label>{place.rejectionReason}</Label> : null}<NativeAction title="إعادة الإرسال للمراجعة" disabled={busy} onPress={() => { void perform(async () => { await placesClient.resubmit(place.id, origin); pending(); }); }} /></Section> : null}
      <NativeAction title="حذف المكان" destructive disabled={busy} onPress={removePlace} />
    </> : null}
    {notice ? <Label>{notice}</Label> : null}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}
  </ScrollView></SafeAreaView></Modal>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/ManagePlaceDialog.tsx; confidence medium; todos 1 isolated owner media/status transitions and native editing verification.
