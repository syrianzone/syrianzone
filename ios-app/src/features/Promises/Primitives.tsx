import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { api, ApiError } from '../../api';
import { Label, Section } from '../../components';
import { NativeAction, NativeSymbol, type SFSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useAccount } from '../../platform/account';
import { getDeviceId } from '../../platform/device';
import { useForegroundClock } from '../../platform/clock';
import { readDocument, writeDocument } from '../../platform/storage';
import { record } from '../../platform/validation';
import { decodeVotes, newestVotes, rememberVotes, STATE_LABEL, type PromiseCardData } from './model';
import { format } from './rules';
import { beginVote, finishVote, promiseVoteKey, readVote, restoreChoice, subscribeVotes } from './vote-state';

const emptyVotes = Object.freeze({ yes: 0, no: 0 });

export function SpeakerPortrait({ name, url, size = 52 }: { name: string | null; url: string | null; size?: number }): React.JSX.Element {
  const { colors } = useTheme(); const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed ? <Image source={{ uri: url }} accessibilityLabel={name ?? 'المسؤول'} cachePolicy="memory-disk" contentFit="cover" onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <View accessibilityLabel={name ?? 'لا تتوفر صورة'} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}><NativeSymbol name="person" size={size / 2} /></View>;
}
export function StateBadge({ card }: { card: PromiseCardData }): React.JSX.Element {
  const { colors } = useTheme(); const color = card.state === 'broken' || card.state === 'overdue' ? colors.danger : card.state === 'fulfilled' || card.state === 'partially_fulfilled' ? colors.success : colors.secondary;
  return <Label style={{ color, fontWeight: '700' }}>{STATE_LABEL[card.state]}{card.keptLate ? '، بعد الموعد' : ''}</Label>;
}
export function PromiseCountdown({ card, live = false, compact = false }: { card: PromiseCardData; live?: boolean; compact?: boolean }): React.JSX.Element {
  const { colors } = useTheme(); const n = card.counter.value; const word = format.dayWord(n ?? 0);
  const captions: Record<PromiseCardData['counter']['mode'], string> = { left: `${word} حتى الموعد`, today: 'الموعد اليوم', overdue: `${word} من التأخير`, since: `${word} منذ إطلاق الوعد`, early: `${word} قبل الموعد`, ontime: 'في يوم الموعد', late: `${word} بعد الموعد`, took: `${word} بعد إطلاقه`, closed: STATE_LABEL[card.state] };
  const caption = format.calendarCounterCaption(card.counter, card) ?? captions[card.counter.mode];
  const symbols: Record<PromiseCardData['state'], SFSymbol> = { pending: 'hourglass', in_progress: 'wrench', overdue: 'alarm', fulfilled: 'checkmark.seal', partially_fulfilled: 'circle.dashed', broken: 'xmark.circle', postponed: 'calendar.badge.clock', retracted: 'arrow.uturn.backward' };
  return <View accessible accessibilityLabel={`${n == null ? '' : n} ${captions[card.counter.mode]}`} style={{ gap: 4, alignItems: 'center' }}>{n == null ? <NativeSymbol name={symbols[card.state]} size={compact ? 28 : 48} /> : <Label style={{ fontSize: compact ? 32 : 54, lineHeight: compact ? 42 : 66, fontWeight: '800', fontVariant: ['tabular-nums'], color: card.state === 'overdue' ? colors.danger : colors.text }}>{card.counter.mode === 'overdue' ? '+' : ''}{n}</Label>}<Label secondary style={{ textAlign: 'center', fontSize: compact ? 13 : 16 }}>{caption}</Label>{live && card.counter.mode === 'left' && card.deadlineDate ? <DeadlineClock deadline={card.deadlineDate} /> : null}</View>;
}
function DeadlineClock({ deadline }: { deadline: string }): React.JSX.Element {
  const now = useForegroundClock(30_000); const diff = Math.max(0, Date.parse(`${deadline}T23:59:59+03:00`) - now.getTime()); const days = Math.floor(diff / 86_400_000); const hours = Math.floor(diff % 86_400_000 / 3_600_000); const minutes = Math.floor(diff % 3_600_000 / 60_000);
  return <Label secondary style={{ textAlign: 'center' }}>الوقت المتبقي: {format.daysPhrase(days)} و{format.hoursPhrase(hours)} و{format.minutesPhrase(minutes)}</Label>;
}
export function TargetProgress({ card }: { card: PromiseCardData }): React.JSX.Element | null {
  const { colors } = useTheme(); const target = card.target; if (!target) return null;
  return <Section><Label style={{ fontWeight: '700' }}>التقدّم نحو الهدف</Label><Label>الهدف: {target.value.toLocaleString('en-US')} {target.unit ?? ''}</Label>{target.baseline !== null ? <Label secondary>خط الأساس: {target.baseline.toLocaleString('en-US')} {target.baselineNote ?? ''}</Label> : null}<Label>المحقّق: {target.current == null ? 'لم يُعلن بعد' : target.current.toLocaleString('en-US')}{target.currentOn ? ` حتى ${format.formatDate(target.currentOn)}` : ''}</Label>{target.percent != null ? <><View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.max(0, Math.min(100, target.percent)), text: `${target.percent.toFixed(1)} بالمئة` }} style={{ height: 10, backgroundColor: colors.separator, borderRadius: 5 }}><View style={{ width: `${Math.max(0, Math.min(100, target.percent))}%`, height: 10, borderRadius: 5, backgroundColor: colors.accent }} /></View><Label secondary>{target.percent.toFixed(1)}%</Label></> : null}</Section>;
}
export function PromiseVote({ card }: { card: PromiseCardData }): React.JSX.Element {
  const { colors } = useTheme(); const account = useAccount(); const key = promiseVoteKey(account.user?.id ?? null, card.number);
  const state = useSyncExternalStore(subscribeVotes, () => readVote(key), () => readVote(key));
  const mine = state.choice, busy = state.busy, error = state.error, needsLogin = state.needsLogin;
  const votes = useSyncExternalStore(subscribeVotes,
    () => newestVotes(card.number, card.votes ?? emptyVotes),
    () => newestVotes(card.number, card.votes ?? emptyVotes));
  useEffect(() => { let current = true; void readDocument(key, value => { if (value !== null && typeof value !== 'boolean') throw new Error('اختيار محفوظ غير صالح'); return value; }, null).then(choice => { if (current) restoreChoice(key, choice); }).catch(() => { if (current && !readVote(key).busy) finishVote(key, { error: 'تعذّر قراءة اختيارك السابق على هذا الجهاز' }); }); return () => { current = false; }; }, [key]);
  const cast = async (believes: boolean) => {
    if (!account.ready || account.busy || !card.votingOpen || readVote(key).choice === believes || !beginVote(key)) return;
    const generation = account.sessionGeneration; const fromProps = card.votes ?? { yes: 0, no: 0 };
    try { const deviceId = await getDeviceId(); const next = await api.request(`promises/${card.number}/vote`, value => decodeVotes(record(value).votes), { method: 'POST', body: { believes, device_id: deviceId }, authenticated: Boolean(account.user), sessionGeneration: generation }); rememberVotes(card.number, next, fromProps);
      // Keep the flight owned by the feature rather than one compact/wide widget instance.
      let storageError: string | null = null;
      try { await writeDocument(key, believes); } catch { storageError = 'سُجّل رأيك وتعذّر حفظ اختيارك على هذا الجهاز'; }
      finishVote(key, { choice: believes, votes: next, error: storageError });
    } catch (reason) { finishVote(key, { error: reason instanceof Error ? reason.message : 'تعذّر تسجيل رأيك', needsLogin: reason instanceof ApiError && reason.status === 401 }); }
  };
  const total = votes.yes + votes.no;
  return <Section><Label style={{ fontWeight: '700' }}>{card.votingOpen ? 'برأيك، هل سيتحقق هذا الوعد؟' : 'أُغلق التصويت بعد صدور الحكم'}</Label><Label secondary>{votes.yes} نعم، {votes.no} لا، {total ? Math.round(votes.yes / total * 100) : 0}% يرجّحون تحققه</Label>{card.votingOpen ? <><NativeAction title={`${mine === true ? '✓ ' : ''}نعم، أعتقد أنه سيتحقق`} disabled={busy || mine === true || account.busy || !account.ready} onPress={() => void cast(true)} /><NativeAction title={`${mine === false ? '✓ ' : ''}لا، لا أعتقد أنه سيتحقق`} disabled={busy || mine === false || account.busy || !account.ready} onPress={() => void cast(false)} /></> : null}{error ? <Label style={{ color: colors.danger }}>{error}</Label> : null}{needsLogin ? <NativeAction title="تسجيل الدخول مجدداً" onPress={() => { void account.signIn().catch(reason => finishVote(key, { error: reason instanceof Error ? reason.message : 'تعذّر تسجيل الدخول' })); }} /> : null}</Section>;
}
// PORT STATUS: source Domain/promises/SpeakerAvatar.tsx and Pages/Promises/_components/{Countdown,TargetProgress,VotePanel}.tsx; confidence medium; todos 0.
