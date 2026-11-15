import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, SectionList, View } from 'react-native';
import { Image } from 'expo-image';
import { api } from '../../api';
import { AdaptivePanes, contentStyle, EmptyState, Heading, Label, RequestStatus, Section } from '../../components';
import { NativeAction, NativePicker, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useResource } from '../../resource';
import { useFeatureNavigation, type FeatureScreenProps } from '../../platform/features';
import { getDeviceId } from '../../platform/device';
import { useForegroundClock } from '../../platform/clock';
import { readDocument, writeDocument } from '../../platform/storage';
import { shareFile, shareZipFiles } from '../../platform/files';
import { record } from '../../platform/validation';
import { ballot, CORE_POLL_SLUG, decodeTierPage, pollCooldownKey, initialBoard, moveCandidates, TIER_KEYS, TIERS, type Board, type Candidate, type TierKey, type TierPage } from './model';
import { TierExport } from './Export';
import { TierLeaderboard } from './Leaderboard';
import { PollCatalogue } from './Polls';

export function TierListScreen(props: FeatureScreenProps): React.JSX.Element { return props.params.view === 'leaderboard' ? <TierLeaderboard {...props} /> : props.params.view === 'polls' ? <PollCatalogue /> : <BoardLoader {...props} />; }
function BoardLoader({ params }: FeatureScreenProps): React.JSX.Element {
  const slug = params.poll || CORE_POLL_SLUG;
  const resource = useResource(useCallback(signal => { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(slug)) return Promise.reject(new Error('رابط الاستطلاع غير صالح')); return api.page(slug === CORE_POLL_SLUG ? '/tierlist' : `/polls/${slug}`, slug === CORE_POLL_SLUG ? 'TierList/Index' : 'Polls/Show', decodeTierPage, { signal }); }, [slug]));
  return resource.data ? <TierBoard key={`${resource.data.poll.id}|${resource.data.voteDay}`} data={resource.data} /> : <AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><Heading>قائمة التقييم</Heading><RequestStatus resource={resource} /></ScrollView>} />;
}
const safeName = (name: string) => name.replace(/[^\p{L}\p{N}_. -]/gu, '_').replace(/^\.+/, '').trim().slice(0, 80) || 'candidate';
function photoInfo(candidate: Candidate): { url: string; filename: string; mimeType: string } | null {
  let url = candidate.originalUrl || candidate.imageUrl; if (!url) return null;
  if (url.includes('/cdn-cgi/image/')) { const parsed = new URL(url); const suffix = parsed.pathname.split('/cdn-cgi/image/')[1] ?? ''; url = `${parsed.origin}${suffix.slice(suffix.indexOf('/'))}`; }
  const extension = new URL(url).pathname.match(/\.(jpe?g|png|webp|gif|svg)$/i)?.[1]?.toLowerCase() ?? 'png';
  return { url, filename: `${safeName(candidate.name)}.${extension}`, mimeType: extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'svg' ? 'image/svg+xml' : `image/${extension}` };
}
function Cooldown({ until, onExpire }: { until: number; onExpire(): void }): React.JSX.Element {
  const now = useForegroundClock(); const seconds = Math.max(0, Math.ceil((until - now.getTime()) / 1000));
  useEffect(() => { if (!seconds) onExpire(); }, [seconds, onExpire]);
  return <Label secondary>يمكنك إرسال تصويت آخر بعد {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</Label>;
}
function CandidateRow({ candidate, selected, onSelect, onPhoto }: { candidate: Candidate; selected: boolean; onSelect(): void; onPhoto(): void }): React.JSX.Element {
  const { colors } = useTheme(); const [failed, setFailed] = useState(false);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${candidate.name}، ${candidate.title ?? ''}، ${selected ? 'محدد' : 'اضغط للتحديد'}`} onPress={onSelect} onLongPress={onPhoto} style={{ padding: 12, marginBottom: 8, borderRadius: 16, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.separator, backgroundColor: selected ? colors.accentMuted : colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    {candidate.imageUrl && !failed ? <Image source={{ uri: candidate.imageUrl }} cachePolicy="memory-disk" onError={() => setFailed(true)} accessibilityLabel={candidate.name} contentFit="cover" style={{ width: 64, height: 64, borderRadius: 12 }} /> : <NativeSymbol name="person.crop.square" size={42} />}
    <View style={{ flex: 1 }}><Label style={{ fontWeight: '700' }}>{candidate.name}</Label>{candidate.title ? <Label secondary>{candidate.title}</Label> : null}</View>{selected ? <NativeSymbol name="checkmark.circle.fill" /> : null}
  </Pressable>;
}
function TierBoard({ data }: { data: TierPage }): React.JSX.Element {
  const { colors } = useTheme(); const navigation = useFeatureNavigation(); const initialGroup = data.groups.find(group => group.isDefault)?.id || data.groups[0]?.id || 'all';
  const [groupId, setGroupId] = useState(initialGroup); const [board, setBoard] = useState(() => initialBoard(data, initialGroup)); const boardRef = useRef(board); const [selected, setSelected] = useState<Set<string>>(() => new Set()); const [target, setTarget] = useState<TierKey | 'bank'>('S');
  const [until, setUntil] = useState<number | null>(null); const [cooldownReady, setCooldownReady] = useState(false); const [busy, setBusy] = useState(false); const running = useRef(false); const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null); const [exported, setExported] = useState<Board | null>(null); const [photo, setPhoto] = useState<Candidate | null>(null);
  const key = pollCooldownKey(data.poll.id, data.voteDay);
  useEffect(() => { let active = true; void readDocument(key, value => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('وقت الانتظار غير صالح'); return value; }, 0).then(value => { if (active) { setUntil(value > Date.now() ? value : null); setCooldownReady(true); } }).catch(reason => { if (active) { setError(reason instanceof Error ? reason.message : 'تعذّر قراءة وقت الانتظار'); setCooldownReady(true); } }); return () => { active = false; }; }, [key]);
  const candidates = useMemo(() => new Map(data.candidates.map(candidate => [candidate.id, candidate])), [data]);
  const sections = useMemo(() => [{ title: 'البطاقات غير المصنفة', tier: 'bank' as const, data: board.bank.map(id => candidates.get(id)!) }, ...TIER_KEYS.map(tier => ({ title: `${tier}: ${TIERS[tier].arabic}`, tier, data: board.tiers[tier].map(id => candidates.get(id)!) }))], [board, candidates]);
  const perform = async (action: () => Promise<void>) => { if (running.current) return; running.current = true; setBusy(true); setError(null); setMessage(null); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'تعذّر إكمال الإجراء'); } finally { running.current = false; setBusy(false); } };
  const move = (tier: TierKey | 'bank') => { const next = moveCandidates(boardRef.current, [...selected], tier); boardRef.current = next; setBoard(next); setSelected(new Set()); setMessage(null); };
  const reset = (nextGroup = groupId) => { const next = initialBoard(data, nextGroup); boardRef.current = next; setBoard(next); setSelected(new Set()); setGroupId(nextGroup); setMessage(null); };
  const expire = useCallback(() => setUntil(null), []);
  const submit = () => void perform(async () => { if (until && until > Date.now()) throw new Error('انتظر انتهاء المهلة قبل التصويت مجدداً'); const payload = ballot(data, boardRef.current, await getDeviceId()); await api.request(`polls/${data.poll.slug}/ballots`, value => { if (record(value).ok !== true) throw new Error('لم يتم تأكيد التصويت'); }, { method: 'POST', body: payload }); const next = Date.now() + 60_000; setUntil(next); await writeDocument(key, next); setMessage('تم تسجيل التصويت'); });
  const currentIds = [...board.bank, ...TIER_KEYS.flatMap(tier => board.tiers[tier])];
  return <><AdaptivePanes primary={<SectionList sections={sections} keyExtractor={candidate => candidate.id} contentContainerStyle={contentStyle} stickySectionHeadersEnabled={false} initialNumToRender={12} windowSize={7}
    ListHeaderComponent={<View style={{ gap: 16 }}><Heading subtitle="تقييم مجتمعي غير رسمي، اضغط لتحديد البطاقات ثم انقلها إلى أحد المستويات">{data.poll.slug === CORE_POLL_SLUG ? 'تير ليست الحكومة السورية الجديدة' : data.poll.title}</Heading><NativeAction title="النتائج العامة والترتيب" systemImage="chart.bar" onPress={() => navigation.open('tierlist', { view: 'leaderboard', poll: data.poll.slug })} />{data.groups.length ? <NativePicker label="التصنيف" value={groupId} onChange={value => reset(value)} options={data.groups.map(group => ({ value: group.id, label: group.name }))} disabled={busy} /> : null}
      {error ? <Section><Label style={{ color: colors.danger }}>{error}</Label></Section> : null}{message ? <Label style={{ color: colors.success }}>{message}</Label> : null}{until ? <Cooldown until={until} onExpire={expire} /> : null}
      <Section><Label>{selected.size} بطاقة محددة. حدّد بطاقات من القائمة أو من أي مستوى، ثم اختر وجهتها.</Label><NativePicker<TierKey | 'bank'> label="المستوى المطلوب" value={target} onChange={setTarget} options={[...TIER_KEYS.map(value => ({ value, label: `${value}: ${TIERS[value].arabic}` })), { value: 'bank', label: 'إعادة إلى غير المصنفة' }]} /><NativeAction title="نقل البطاقات المحددة" onPress={() => move(target)} disabled={busy || !selected.size} prominent /><NativeAction title="إلغاء التحديد" onPress={() => setSelected(new Set())} disabled={!selected.size} /></Section></View>}
    renderSectionHeader={({ section }) => <View style={{ gap: 8, paddingVertical: 12 }}><Label accessibilityRole="header" style={{ fontSize: 21, fontWeight: '700', color: section.tier === 'bank' ? colors.text : '#ffffff', backgroundColor: section.tier === 'bank' ? colors.background : TIERS[section.tier].color, borderRadius: 10, padding: 10 }}>{section.title} ({section.data.length})</Label>{selected.size ? <NativeAction title={`نقل المحدد إلى ${section.title}`} onPress={() => move(section.tier)} disabled={busy} /> : null}{!section.data.length ? <Label secondary>لا توجد بطاقات في هذا المستوى</Label> : null}</View>}
    renderItem={({ item }) => <CandidateRow candidate={item} selected={selected.has(item.id)} onSelect={() => { if (busy) return; setSelected(previous => { const next = new Set(previous); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; }); }} onPhoto={() => setPhoto(item)} />}
    ListFooterComponent={<Section><NativeAction title="إرسال التصويت" systemImage="checkmark.seal" onPress={submit} disabled={busy || !cooldownReady || until !== null || !data.poll.active} prominent /><Label secondary>اختر ثلاثة مرشحين على الأقل. يعالج الخادم قيود التصويت.</Label><NativeAction title="حفظ قائمة التقييم كصورة" systemImage="photo" onPress={() => setExported(boardRef.current)} disabled={busy} /><NativeAction title="تحميل صور التصنيف في ملفZIP" systemImage="archivebox" disabled={busy || !currentIds.length} onPress={() => void perform(async () => { const files = currentIds.map(id => { const candidate = candidates.get(id)!; const info = photoInfo(candidate); return info ? { url: info.url, filename: `${safeName(candidate.name)}-${id}.${info.filename.split('.').pop()}` } : null; }).filter((value): value is { url: string; filename: string } => value !== null); if (!files.length) throw new Error('لا توجد صور متاحة لهذا التصنيف'); await shareZipFiles(files, `${safeName(data.groups.find(group => group.id === groupId)?.name ?? 'tierlist')}-images.zip`); })} /><NativeAction title="إعادة ضبط الترتيب" systemImage="arrow.counterclockwise" onPress={() => reset()} disabled={busy} /><NativeAction title="جميع الاستبيانات" onPress={() => navigation.open('tierlist', { view: 'polls' })} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}{message ? <Label style={{ color: colors.success }}>{message}</Label> : null}</Section>} ListEmptyComponent={<EmptyState title="لا توجد بطاقات متاحة" />} />} />
    <Modal visible={exported !== null} presentationStyle="pageSheet" animationType="slide" onRequestClose={() => setExported(null)}><AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><NativeAction title="إغلاق صورة التقييم" systemImage="xmark" onPress={() => setExported(null)} />{exported ? <TierExport data={data} board={exported} /> : null}</ScrollView>} /></Modal>
    <Modal visible={photo !== null} presentationStyle="pageSheet" onRequestClose={() => setPhoto(null)}><AdaptivePanes primary={<ScrollView contentContainerStyle={contentStyle}><NativeAction title="إغلاق الصورة" systemImage="xmark" onPress={() => setPhoto(null)} />{photo ? <><Heading>{photo.name}</Heading>{photo.imageUrl ? <Image source={{ uri: photo.imageUrl }} contentFit="contain" cachePolicy="memory-disk" accessibilityLabel={photo.name} style={{ height: 320, width: '100%' }} /> : <EmptyState title="لا تتوفر صورة" />}<NativeAction title="تحميل الصورة الأصلية أو مشاركتها" systemImage="square.and.arrow.up" disabled={busy || !photoInfo(photo)} onPress={() => void perform(async () => { const info = photoInfo(photo); if (info) await shareFile(info); })} />{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}</> : null}</ScrollView>} /></Modal></>;
}
// PORT NOTE: Mobile tap/multi-select/move supports every board placement, including moving a candidate to the end of its existing tier. Long press opens original-image actions.
// PORT STATUS: source resources/js/Pages/TierList/Index.tsx and Domain/polls/TierBoard.tsx; confidence medium; todos 0.
