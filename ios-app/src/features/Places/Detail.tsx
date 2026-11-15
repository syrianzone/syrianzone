import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdaptivePanes, contentStyle, FormField, Heading, Label, Photo, RequestStatus, Section } from '../../components';
import { MapView } from '../../MapView';
import { directionsUrl } from '../../map-data';
import { useResource } from '../../resource';
import { placeCategories, type Place } from '../../domain';
import { useAppState } from '../../state';
import { NativeAction, NativePicker } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAccount } from '../../platform/account';
import { openExternal, shareText } from '../../platform/links';
import { useFeatureNavigation } from '../../platform/features';
import { GuideBadge } from '../../ui/GuideBadge';
import { placesClient } from './api';
import { PhotoViewer } from './PhotoViewer';
import { deviceSnapshot, reportReasons, type ReportReason } from './model';

export function PlaceDetailScreen({ id, snapshot }: { id: number; snapshot?: Place }): React.JSX.Element {
  const account = useAccount(), local = useAppState(), { colors } = useTheme(), navigation = useFeatureNavigation();
  const generation = account.user ? account.sessionGeneration : undefined;
  const resource = useResource(useCallback((signal: AbortSignal) => placesClient.detail(id, signal, generation), [id, generation]), { enabled: account.ready && !account.busy });
  const [error, setError] = useState<string | null>(null), [notice, setNotice] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null), [report, setReport] = useState(false), [reason, setReason] = useState<ReportReason>('inappropriate'), [details, setDetails] = useState('');
  const [engagement, setEngagement] = useState<{ generation: number; id: number; saved: boolean; count: number } | null>(null);
  const working = useRef(false);
  const detail = resource.data, place = detail ?? snapshot ?? local.saved.find(item => item.id === id);
  const deviceSaved = local.saved.some(item => item.id === id);
  const snapshotForDevice = place && (!detail || detail.status === 'approved') ? deviceSnapshot(place) : null;
  const current = engagement?.id === id && engagement.generation === account.sessionGeneration ? engagement : null;
  const serverSaved = current?.saved ?? detail?.savedByMe ?? false, saves = current?.count ?? detail?.savesCount ?? 0;
  const pins = useMemo(() => place ? [{ id: String(place.id), name: place.name, coordinate: place.coordinate }] : [], [place]);
  const photos = useMemo(() => detail?.photos.map(photo => ({ id: photo.id, url: photo.url, name: detail.name, placeId: detail.id })) ?? [], [detail]);
  async function perform(action: () => Promise<void>): Promise<void> {
    if (working.current) return;
    working.current = true; setBusy(true); setError(null); setNotice(null);
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'تعذر إكمال الإجراء.'); }
    finally { working.current = false; setBusy(false); }
  }
  const login = (): void => { void perform(() => account.signIn()); };
  const toggleServerSave = (): void => { if (!account.user) { setNotice('سجّل الدخول لحفظ المكان في حسابك.'); return; } const origin = account.sessionGeneration; void perform(async () => { const result = await placesClient.save(id, !serverSaved, origin); setEngagement({ generation: origin, id, saved: result.saved, count: result.count }); }); };
  const submitReport = (): void => { if (!account.user) { setNotice('سجّل الدخول لإرسال البلاغ.'); return; } const origin = account.sessionGeneration; void perform(async () => { const response = await placesClient.report(id, reason, details, origin); setNotice(response); setReport(false); setDetails(''); }); };
  const map = <MapView pins={pins} />;
  const content = (inlineMap: boolean): React.JSX.Element => <ScrollView contentContainerStyle={contentStyle}><RequestStatus resource={resource} />{place ? <>
    <Heading subtitle={placeCategories.find(item => item.key === place.category)?.label ?? ''}>{place.name}</Heading>
    {!detail ? <Label secondary>{deviceSaved ? 'نسخة محفوظة على هذا الجهاز. حمّل التفاصيل عند الاتصال.' : 'عرض بيانات القائمة. التفاصيل غير متاحة الآن.'}</Label> : null}
    {detail?.photos.length ? <ScrollView horizontal contentContainerStyle={{ gap: 12 }}>{detail.photos.map((photo, index) => <View key={photo.id} style={{ width: 270 }}><Photo url={photo.url} label={place.name} height={225} /><NativeAction title={`فتح الصورة ${index + 1}`} onPress={() => setViewer(index)} /></View>)}</ScrollView> : <Photo url={place.thumbnail} label={place.name} height={230} />}
    {place.description ? <Section><Label>{place.description}</Label></Section> : null}
    {detail ? <Section><View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>{detail.user.avatar ? <Image source={{ uri: detail.user.avatar }} style={{ width: 44, height: 44, borderRadius: 22 }} accessibilityLabel={detail.user.name} contentFit="cover" cachePolicy="memory-disk" /> : null}<Label>{detail.user.name}</Label></View><GuideBadge level={detail.user.level} /><NativeAction title="عرض مساهمات المرشد" onPress={() => navigation.open('places', { guideId: String(detail.user.id), guideName: detail.user.name })} /></Section> : null}
    <Section><Label style={{ writingDirection: 'ltr', textAlign: 'right' }}>{place.coordinate.latitude.toFixed(5)}, {place.coordinate.longitude.toFixed(5)}</Label><NativeAction title="نسخ الإحداثيات" onPress={() => { void perform(async () => { await Clipboard.setStringAsync(`${place.coordinate.latitude}, ${place.coordinate.longitude}`); setNotice('تم نسخ الإحداثيات.'); }); }} /></Section>
    {detail?.status === 'approved' ? <Section><Label>{saves} حفظ</Label><NativeAction title={serverSaved ? 'إزالة من محفوظات الحساب' : 'حفظ في حسابك'} systemImage={serverSaved ? 'bookmark.fill' : 'bookmark'} disabled={busy || account.busy || !account.ready} onPress={toggleServerSave} /><NativeAction title="الإبلاغ عن المكان" disabled={busy} onPress={() => { if (!account.user) setNotice('سجّل الدخول لإرسال البلاغ.'); else setReport(true); }} /></Section> : detail ? <Label>{detail.status === 'pending' ? 'قيد المراجعة' : 'مرفوض'}</Label> : null}
    <Section>{deviceSaved || snapshotForDevice ? <NativeAction title={deviceSaved ? 'إزالة من محفوظات الجهاز' : 'حفظ على الجهاز'} systemImage={deviceSaved ? 'bookmark.fill' : 'bookmark'} disabled={!local.storageAvailable || local.busy} onPress={() => { if (deviceSaved || snapshotForDevice) void local.toggleSaved(snapshotForDevice ?? place); }} /> : null}<Label secondary>هذه المحفوظات خاصة بهذا الجهاز، وهي منفصلة عن محفوظات الحساب.</Label><NativeAction title="الاتجاهات في خرائط Apple" onPress={() => { void perform(() => openExternal(directionsUrl(place.coordinate, place.name))); }} /><NativeAction title="افتح في خرائط جوجل" onPress={() => { void perform(() => openExternal(`https://www.google.com/maps/search/?api=1&query=${place.coordinate.latitude},${place.coordinate.longitude}`)); }} /><NativeAction title="مشاركة المكان" onPress={() => { void perform(() => shareText(place.name, `https://syrian.zone/mishwar?place=${place.id}`)); }} /></Section>
    {notice ? <Label>{notice}</Label> : null}{!account.user && notice ? <NativeAction title="تسجيل الدخول" disabled={!account.ready || account.busy || busy} onPress={login} /> : null}{error || local.error ? <Label style={{ color: colors.danger }}>{error ?? local.error}</Label> : null}
    {inlineMap ? <View style={{ height: 300 }}>{map}</View> : null}
  </> : null}</ScrollView>;
  return <><AdaptivePanes primary={content(false)} secondary={<View style={{ flex: 1, padding: 18 }}>{map}</View>} compact={content(true)} /><PhotoViewer photos={photos} initialIndex={viewer} close={() => setViewer(null)} />
    <Modal visible={report} presentationStyle="pageSheet" onRequestClose={() => { if (!busy) setReport(false); }}><SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={contentStyle}><Heading>الإبلاغ عن المكان</Heading><NativePicker<ReportReason> label="سبب البلاغ" value={reason} options={[...reportReasons]} onChange={setReason} disabled={busy} /><FormField label="تفاصيل إضافية" value={details} onChange={setDetails} multiline maxLength={1000} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}<NativeAction title={busy ? 'جارٍ إرسال البلاغ' : 'إرسال البلاغ'} disabled={busy || account.busy || !account.user} onPress={submitReport} /><NativeAction title="إلغاء" disabled={busy} onPress={() => setReport(false)} /></ScrollView></SafeAreaView></Modal>
  </>;
}
// PORT STATUS: source resources/js/Pages/Places/_components/PlaceDetailView.tsx,PhotoGallery.tsx,EngagementBar.tsx,ReportButton.tsx; confidence medium; todos 1 isolated account actions and native detail/gallery verification.
