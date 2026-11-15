import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Modal, ScrollView, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { Heading, Label, Section, contentStyle } from '../../components';
import { NativeAction, NativeSymbol } from '../../ui/native';
import { useTheme } from '../../ui/theme';
import { useFeatureNavigation } from '../../platform/features';
import { shareText } from '../../platform/links';
import { guessWhoApi } from './api';
import { getGuestIdentity } from './session';
import { connectRoom } from './realtime';
import { updateFromBroadcast, type Character, type Room, type Snapshot } from './model';
function Portrait({ character, height = 140 }: { character: Character; height?: number }): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  return failed ? <View style={{ height, justifyContent: 'center', alignItems: 'center' }}><NativeSymbol name="person.crop.square" size={54} /></View> : <Image source={{ uri: character.image }} accessibilityLabel={character.name} onError={() => setFailed(true)} contentFit="cover" cachePolicy="memory-disk" style={{ width: '100%', height, borderRadius: 14 }} />;
}
export function GuessWhoRoom({ code }: { code: string }): React.JSX.Element {
  const { colors } = useTheme();
  const navigation = useFeatureNavigation();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [room, setRoom] = useState<Room | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [peer, setPeer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const posting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState<{ kind: 'secret' | 'guess'; character: Character } | null>(null);
  const requests = useRef<AbortController | null>(null);
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => {
    if (!focused || !active) return;
    const controller = new AbortController(); requests.current = controller;
    let stop: (() => void) | undefined;
    setLoading(true); setError(null); setConnected(false); setPeer(false);
    const refresh = (guest: string): void => { void guessWhoApi.snapshot(code, guest, controller.signal).then(value => { if (!controller.signal.aborted) { setSnapshot(value); setError(null); } }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر استعادة حالة الغرفة.'); }); };
    void (async () => {
      const guest = await getGuestIdentity();
      const roster = await guessWhoApi.room(code, controller.signal);
      await guessWhoApi.join(code, guest, controller.signal);
      const own = await guessWhoApi.snapshot(code, guest, controller.signal);
      if (controller.signal.aborted) return;
      setIdentity(guest); setRoom(roster); setSnapshot(own);
      stop = connectRoom(code, guest, controller.signal, { state: event => setSnapshot(previous => previous ? updateFromBroadcast(previous, event, guest) : previous),
        peer: setPeer, connection: setConnected, subscribed: () => refresh(guest), error: setError });
    })().catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر الانضمام إلى الغرفة.'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); stop?.(); if (requests.current === controller) requests.current = null; };
  }, [code, revision, focused, active]);
  const perform = async (action: 'select_ready' | 'elimination_update' | 'pass_turn' | 'guess', payload: Record<string, unknown>, patch: Partial<Snapshot> = {}): Promise<void> => {
    const controller = requests.current;
    if (!identity || !controller || controller.signal.aborted || posting.current) return;
    posting.current = true; setBusy(true); setError(null);
    try { const ack = await guessWhoApi.action(code, identity, action, payload, controller.signal); if (requests.current === controller && !controller.signal.aborted) setSnapshot(previous => previous ? { ...previous, ...ack, ...patch } : previous); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'تعذر إرسال الحركة.'); }
    finally { posting.current = false; setBusy(false); }
  };
  const selectOrGuess = async (): Promise<void> => { const choice = confirming; if (!choice) return; await perform(choice.kind === 'secret' ? 'select_ready' : 'guess', choice.kind === 'secret' ? { id: choice.character.id } : { character_id: choice.character.id }, choice.kind === 'secret' ? { myCharacterId: choice.character.id } : {}); setConfirming(null); };
  const eliminate = (id: number): void => { if (!snapshot) return; const ids = snapshot.myEliminated.includes(id) ? snapshot.myEliminated.filter(value => value !== id) : [...snapshot.myEliminated, id]; void perform('elimination_update', { eliminated: ids }, { myEliminated: ids }); };
  const myTurn = snapshot?.status === 'playing' && snapshot.turn === identity;
  const secret = room?.characters.find(character => character.id === snapshot?.myCharacterId);
  const share = (): void => { void shareText('تعال نلعب مَنْ هُوَ؟', `https://syrian.zone/guesswho/room/${encodeURIComponent(code)}`).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'تعذرت مشاركة الغرفة.')); };
  return <FlatList data={room?.characters ?? []} numColumns={2} keyExtractor={item => String(item.id)} style={{ backgroundColor: colors.background }} contentContainerStyle={contentStyle} columnWrapperStyle={{ gap: 12 }} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    ListHeaderComponent={<View style={{ gap: 14, marginBottom: 14 }}><Heading {...(room ? { subtitle: room.category } : {})}>غرفة مَنْ هُوَ؟</Heading><Label style={{ writingDirection: 'ltr', fontSize: 13 }}>{code}</Label><NativeAction title="مشاركة رابط الغرفة" systemImage="square.and.arrow.up" onPress={share} />
      {loading ? <ActivityIndicator color={colors.accent} accessibilityLabel="جارٍ الانضمام" /> : null}<Label secondary>{connected ? peer ? 'الخصم متصل' : 'بانتظار اتصال الخصم' : 'الاتصال بالغرفة غير جاهز'}</Label>
      {error ? <Section><Label style={{ color: colors.danger }}>{error}</Label><NativeAction title="إعادة الاتصال واستعادة الحالة" systemImage="arrow.clockwise" disabled={busy} onPress={() => setRevision(value => value + 1)} /></Section> : null}
      {snapshot?.status === 'finished' ? <Section><Label>{snapshot.winner === identity ? 'مبروك! خمنت شخصية الخصم وفزت.' : 'انتهت اللعبة وفاز الخصم.'}</Label><NativeAction title="العب مجدداً في غرفة جديدة" onPress={() => navigation.open('guesswho', {})} /></Section> : snapshot?.status === 'playing' ? <Section><Label>{myTurn ? 'دورك الآن' : 'دور الخصم'}</Label><Label>شخصيات الخصم المتبقية: {snapshot.opponentRemaining ?? 'لم يختر بعد'}</Label>{secret ? <><Label>شخصيتك السرية: {secret.name}</Label><Portrait character={secret} height={100} /></> : null}<NativeAction title="إنهاء دورك" disabled={!myTurn || busy || !connected} onPress={() => { void perform('pass_turn', {}); }} /></Section> : <Section><Label>{secret ? 'اخترت شخصيتك. انتظر صديقك.' : 'اختر شخصيتك السرية وأكد الاختيار.'}</Label></Section>}
    </View>}
    renderItem={({ item }) => { const eliminated = snapshot?.myEliminated.includes(item.id) ?? false; return <Section style={{ flex: 1 }}><View style={{ opacity: eliminated ? 0.3 : 1 }}><Portrait character={item} /><Label style={{ fontWeight: '700', textAlign: 'center' }}>{item.name}</Label></View>{snapshot?.status === 'lobby' || snapshot?.status === 'selecting' ? <NativeAction title="اختيار الشخصية" disabled={busy || Boolean(secret)} onPress={() => setConfirming({ kind: 'secret', character: item })} /> : snapshot?.status === 'playing' ? <><NativeAction title="تخمين الشخصية" disabled={!myTurn || busy || eliminated || !connected} onPress={() => setConfirming({ kind: 'guess', character: item })} /><NativeAction title={eliminated ? 'إرجاع' : 'استبعاد'} disabled={busy || !connected} destructive={!eliminated} onPress={() => eliminate(item.id)} /></> : null}</Section>; }}
    ListFooterComponent={<Modal visible={confirming !== null} presentationStyle="pageSheet" onRequestClose={() => setConfirming(null)}><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ ...contentStyle, paddingTop: 30 }}><Heading>{confirming?.kind === 'secret' ? 'تأكيد الشخصية السرية' : 'تأكيد التخمين'}</Heading>{confirming ? <><Portrait character={confirming.character} height={250} /><Label>{confirming.character.name}</Label></> : null}<NativeAction title="نعم، تأكيد" prominent disabled={busy} onPress={() => { void selectOrGuess(); }} /><NativeAction title="إلغاء" disabled={busy} onPress={() => setConfirming(null)} /></ScrollView></Modal>} />;
}
// PORT STATUS: source resources/js/Pages/GuessWho/Room.tsx; confidence medium; todos 1 isolated two-client match and native reconnect/confirmation verification.
