import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, ScrollView, View } from 'react-native';
import { Label, Section, contentStyle } from '../../../components';
import { NativeAction } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import { CardTable } from '../CardTable';
import { GameShell } from '../GameShell';
import { cards, matches, tarneeb, tarneebAi, type Card, type MatchState } from '../engines';
import { useGameRecords } from '../records';
import { sortHand } from '../model';
const NAMES = ['أنت', 'الخصم ١', 'شريكك', 'الخصم ٢'];
const freshMatch = (): MatchState => matches.createMatch({ players: 4, units: tarneeb.TARNEEB_TEAMS, target: tarneeb.DEFAULT_TARNEEB.target });
const RULES = ['أربعة لاعبين، فريقان متقابلان، و١٣ ورقة لكل لاعب.', 'المزايدة ٧ إلى ١٣. الفائز بالطلب يختار الحكم ويبدأ. يجب اتباع اللون إن أمكن.', 'الحكم يفوز على اللون الآخر، وإلا أعلى ورقة من اللون المطلوب تفوز.', 'إن تحقق الطلب يسجل الفريق ما أخذه من طرانيب، وإلا يسجل الخصوم قيمة الطلب.', 'الكبوت الناجح ٢٦، والفاشل يخسر ١٦ ويسجل الخصوم ضعف طرانيبهم. جمع ١٣ بطلب أقل يكسب ٣ إضافية.', 'أول فريق يبلغ ٤١ يفوز.'];
export function TarneebScreen(): React.JSX.Element {
  const [match, setMatch] = useState(freshMatch);
  const [round, setRound] = useState(() => tarneeb.createRound());
  const [selected, setSelected] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [panel, setPanel] = useState<'stats' | 'options' | null>(null);
  const seen = useRef(0);
  const recorded = useRef(false);
  const records = useGameRecords();
  const saveMatch = useRef(records.match); saveMatch.current = records.match;
  const { colors } = useTheme();
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => {
    if (!active || !focused || match.winner !== null) return;
    if (round.phase === 'playing' && round.history.length > seen.current) { seen.current = round.history.length; setPaused(true); return; }
    if (paused || round.phase === 'complete' || round.turn === 0 || round.turn === null) return;
    const timer = setTimeout(() => setRound(current => {
      const seat = current.turn;
      if (seat === null || seat === 0) return current;
      if (current.phase === 'bidding') { const bid = tarneebAi.chooseBid(current, seat); return bid === null ? tarneeb.pass(current, seat) : tarneeb.bid(current, seat, bid); }
      if (current.phase === 'trump') return tarneeb.chooseTrump(current, seat, tarneebAi.chooseTrump(current, seat));
      return current.phase === 'playing' ? tarneeb.playCard(current, seat, tarneebAi.choosePlay(current, seat)) : current;
    }), 750);
    return () => clearTimeout(timer);
  }, [round, paused, active, focused, match.winner]);
  useEffect(() => { if (match.winner !== null && !recorded.current) { recorded.current = true; saveMatch.current('tarneeb', match.winner === 0 ? 'win' : 'loss'); } }, [match.winner]);
  const legal = new Set(!paused && active && round.phase === 'playing' && round.turn === 0 ? tarneeb.legalPlays(round, 0).map(card => card.id) : []);
  const play = (card: Card, dragged: boolean): void => { if (!legal.has(card.id)) return; if (!dragged && selected !== card.id) { setSelected(card.id); return; } setSelected(null); setRound(current => tarneeb.playCard(current, 0, card)); };
  const next = (): void => { const advanced = matches.applyRound(match, tarneeb.isRedeal(round) ? [0, 0] : tarneeb.scoreRound(round)); setMatch(advanced); seen.current = 0; setPaused(false); setSelected(null); if (advanced.winner === null) setRound(tarneeb.createRound(undefined, advanced.dealer)); };
  const restart = (): void => { const fresh = freshMatch(); setMatch(fresh); setRound(tarneeb.createRound(undefined, fresh.dealer)); seen.current = 0; recorded.current = false; setPaused(false); setSelected(null); };
  const shown = paused ? round.history.at(-1)?.plays ?? round.trick : round.trick;
  const hand = useMemo(() => sortHand(round.hands[0] ?? [], 'tarneeb'), [round.hands]);
  return <GameShell title="طرنيب" rules={RULES} actions={<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><NativeAction title="الإحصائيات" systemImage="chart.bar" onPress={() => setPanel('stats')} /></View><View style={{ flex: 1 }}><NativeAction title="خيارات" systemImage="slider.horizontal.3" onPress={() => setPanel('options')} /></View></View>}>
    <Label>{round.declarer === null ? 'جاري المزايدة' : `${NAMES[round.declarer]} طلب ${round.auction.highBid}، الحكم ${round.trump ? cards.SUIT_LABEL[round.trump] : 'لم يحدد'}`}</Label>
    <CardTable hand={hand} counts={round.hands.map(cardsInHand => cardsInHand.length)} names={NAMES} plays={shown} legal={legal} selected={selected} large={records.records.largeCards} onCard={play}>
      <Label secondary>{round.phase === 'complete' ? 'انتهى الدست' : `الدور: ${NAMES[round.turn ?? 0]}`}</Label>
      <Label>الطرانيب: فريقك {round.tricks[0]}، الخصوم {round.tricks[1]}</Label>
    </CardTable>
    {paused ? <NativeAction title="كمّل" prominent onPress={() => setPaused(false)} /> : round.phase === 'bidding' && round.turn === 0 ? <Section><Label>اختر طلبك</Label><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{tarneeb.legalBids(round).map(bid => <View key={bid} style={{ width: 72 }}><NativeAction title={String(bid)} onPress={() => setRound(current => tarneeb.bid(current, 0, bid))} /></View>)}</View><NativeAction title="مرّر" onPress={() => setRound(current => tarneeb.pass(current, 0))} /></Section> : round.phase === 'trump' && round.turn === 0 ? <Section><Label>اختر الحكم</Label>{cards.SUITS.map(suit => <NativeAction key={suit} title={cards.SUIT_LABEL[suit]} onPress={() => setRound(current => tarneeb.chooseTrump(current, 0, suit))} />)}</Section> : null}
    {round.phase === 'complete' ? <Section><Label>{tarneeb.isRedeal(round) ? 'مرر الجميع. إعادة توزيع.' : `نتيجة الدست: ${tarneeb.scoreRound(round).join(' / ')}`}</Label>{match.winner === null ? <NativeAction title="الدست التالي" onPress={next} /> : <><Label>{match.winner === 0 ? 'فاز فريقك!' : 'فاز الخصوم.'}</Label><NativeAction title="لعبة جديدة" onPress={restart} /></>}</Section> : null}
    {records.error ? <Label style={{ color: colors.danger }}>{records.error}</Label> : null}
    <Modal visible={panel !== null} presentationStyle="pageSheet" onRequestClose={() => setPanel(null)}><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ ...contentStyle, paddingTop: 30 }}>{panel === 'stats' ? <><Label>فريقك {match.scores[0] ?? 0}، الخصوم {match.scores[1] ?? 0}، الهدف ٤١</Label><Label>الدست {match.round + 1}</Label><Label>نتائجك: {records.records.tarneeb.wins} فوز، {records.records.tarneeb.losses} خسارة</Label></> : <><NativeAction title={records.records.largeCards ? 'إظهار الأنماط' : 'أرقام كبيرة'} onPress={() => records.large(!records.records.largeCards)} /><NativeAction title="لعبة جديدة" onPress={() => { restart(); setPanel(null); }} /></>}<NativeAction title="تم" onPress={() => setPanel(null)} /></ScrollView></Modal>
  </GameShell>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/Tarneeb.tsx; confidence medium; todos 1 native complete human-match verification.
