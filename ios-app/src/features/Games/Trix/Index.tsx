import { useIsFocused } from '@react-navigation/native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, ScrollView, View } from 'react-native';
import { Label, Section, contentStyle } from '../../../components';
import { NativeAction, NativeSegmented } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import { CardTable } from '../CardTable';
import { GameShell } from '../GameShell';
import { trix, trixAi, type Card, type TrixGame } from '../engines';
import { useGameRecords } from '../records';
import { SheddingLayout } from './SheddingLayout';
import { sortHand } from '../model';
const RULES = ['أربع ممالك، في كل مملكة خمسة طلبات يختار صاحبها ترتيبها. صاحب السبعة كبة يبدأ.', 'البنات: كل بنت ناقص ٢٥. الديناري: كل ورقة ناقص ١٠. اللطوش: كل لطش ناقص ١٥. شيخ الكبة: ناقص ٧٥.', 'يجب اتباع اللون. في شيخ الكبة لا تبدأ بالكبة إلا إن كانت كل أوراقك كبة.', 'التركس يبدأ من الشاب ويكمل نحو الآس والثنين. مرّر فقط عندما لا تملك ورقة قانونية.', 'التركس يدفع ٢٠٠ ثم ١٥٠ ثم ١٠٠ ثم ٥٠ حسب ترتيب إنهاء الأوراق. أعلى مجموع يفوز، منفرداً أو بفريقين.'];
const fresh = (teams: boolean): TrixGame => trix.beginDeal(trix.createGame({ teams }));
export function TrixScreen(): React.JSX.Element {
  const [game, setGame] = useState(() => fresh(false));
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
  const names = ['أنت', 'الخصم ١', game.options.teams ? 'شريكك' : 'اللاعب ٣', 'الخصم ٢'];
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => {
    if (!active || !focused || game.complete) return;
    const deal = game.deal;
    if (deal && deal.contract !== 'trix' && deal.phase === 'playing' && deal.round.history.length > seen.current) { seen.current = deal.round.history.length; setPaused(true); return; }
    if (paused) return;
    if (game.hands) {
      if (trix.kingOf(game) === 0) return;
      const timer = setTimeout(() => setGame(current => current.hands ? trix.chooseContract(current, trixAi.chooseContractFor(current.hands, trix.kingOf(current), current.remaining)) : current), 700);
      return () => clearTimeout(timer);
    }
    if (!deal || deal.phase !== 'playing') return;
    const seat = deal.contract === 'trix' ? deal.turn : deal.round.turn;
    if (seat === 0) return;
    const timer = setTimeout(() => setGame(current => {
      const d = current.deal;
      if (!d || d.phase !== 'playing') return current;
      const turn = d.contract === 'trix' ? d.turn : d.round.turn;
      if (turn === 0) return current;
      const card = trixAi.choosePlay(d, turn, current.options);
      return { ...current, deal: card ? trix.playCard(d, turn, card) : trix.pass(d, turn) };
    }), 700);
    return () => clearTimeout(timer);
  }, [game, paused, active, focused]);
  useEffect(() => { if (game.complete && !recorded.current) { recorded.current = true; const winner = trix.standings(game).winner; saveMatch.current('trix', winner === 0 ? 'win' : 'loss'); } }, [game]);
  const deal = game.deal;
  const hands = useMemo(() => game.hands ?? (deal ? deal.contract === 'trix' ? deal.hands : deal.round.hands : []), [game.hands, deal]);
  const humanHand = useMemo(() => sortHand(hands[0] ?? [], 'trix'), [hands]);
  const seat = deal ? deal.contract === 'trix' ? deal.turn : deal.round.turn : null;
  const humanTurn = active && !paused && deal?.phase === 'playing' && seat === 0;
  const legal = new Set(humanTurn && deal ? trix.legalPlays(deal, 0).map(card => card.id) : []);
  const plays = deal && deal.contract !== 'trix' ? paused ? deal.round.history.at(-1)?.plays ?? deal.round.trick : deal.round.trick : [];
  const restart = (teams = game.options.teams): void => { setGame(fresh(teams)); setSelected(null); setPaused(false); seen.current = 0; recorded.current = false; };
  const play = (card: Card, dragged: boolean): void => { if (!legal.has(card.id)) return; if (!dragged && selected !== card.id) { setSelected(card.id); return; } setSelected(null); setGame(current => current.deal ? { ...current, deal: trix.playCard(current.deal, 0, card) } : current); };
  const next = (): void => { let advanced = trix.finishDeal(game); if (!advanced.complete) advanced = trix.beginDeal(advanced); setGame(advanced); setPaused(false); setSelected(null); seen.current = 0; };
  const totals = trix.standings(game);
  return <GameShell title="تركس" rules={RULES} actions={<View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><NativeAction title="الإحصائيات" systemImage="chart.bar" onPress={() => setPanel('stats')} /></View><View style={{ flex: 1 }}><NativeAction title="خيارات" systemImage="slider.horizontal.3" onPress={() => setPanel('options')} /></View></View>}>
    <Label>المملكة {Math.min(4, game.kingdom + 1)}، الملك {names[trix.kingOf(game)]}{deal ? `، ${trix.CONTRACT_INFO[deal.contract].name}` : ''}</Label>
    <CardTable hand={humanHand} counts={hands.map(hand => hand.length)} names={names} plays={plays} legal={legal} selected={selected} large={records.records.largeCards} onCard={play}>
      {deal?.contract === 'trix' ? <SheddingLayout laid={deal.layout.laid} large={records.records.largeCards} /> : <Label secondary>{seat === null ? 'اختيار الطلب' : `الدور: ${names[seat]}`}</Label>}
    </CardTable>
    {game.hands && trix.kingOf(game) === 0 ? <Section><Label>اختر أحد الطلبات المتبقية</Label>{trix.CONTRACTS.map(contract => <NativeAction key={contract} title={trix.CONTRACT_INFO[contract].name} disabled={!game.remaining.includes(contract)} onPress={() => setGame(current => trix.chooseContract(current, contract))} />)}</Section> : null}
    {paused ? <NativeAction title="كمّل" prominent onPress={() => setPaused(false)} /> : humanTurn && deal?.contract === 'trix' && !legal.size ? <NativeAction title="باس" onPress={() => setGame(current => current.deal ? { ...current, deal: trix.pass(current.deal, 0) } : current)} /> : null}
    {deal?.phase === 'complete' && !game.complete ? <Section><Label>نتيجة الطلب: {trix.scoreDeal(deal).join(' / ')}</Label><NativeAction title="الطلب التالي" onPress={next} /></Section> : null}
    {game.complete ? <Section><Label>{totals.winner === 0 ? 'مبروك، فزت!' : totals.winner === null ? 'تعادل.' : `الفائز ${game.options.teams ? totals.winner === 0 ? 'فريقك' : 'الخصوم' : names[totals.winner]}`}</Label><NativeAction title="لعبة جديدة" onPress={() => restart()} /></Section> : null}
    {records.error ? <Label style={{ color: colors.danger }}>{records.error}</Label> : null}
    <Modal visible={panel !== null} presentationStyle="pageSheet" onRequestClose={() => setPanel(null)}><ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ ...contentStyle, paddingTop: 30 }}>{panel === 'stats' ? <><Label>المملكة {Math.min(4, game.kingdom + 1)}</Label>{totals.totals.map((score, index) => <Label key={index}>{game.options.teams ? index === 0 ? 'فريقك' : 'الخصوم' : names[index]}: {score}</Label>)}<Label>نتائجك {records.records.trix.wins} فوز، {records.records.trix.losses} خسارة</Label></> : <><NativeSegmented options={[{ value: 'solo', label: 'يهودية' }, { value: 'teams', label: 'فريقين' }]} value={game.options.teams ? 'teams' : 'solo'} onChange={mode => { restart(mode === 'teams'); setPanel(null); }} /><NativeAction title={records.records.largeCards ? 'إظهار الأنماط' : 'أرقام كبيرة'} onPress={() => records.large(!records.records.largeCards)} /><NativeAction title="لعبة جديدة" onPress={() => { restart(); setPanel(null); }} /></>}<NativeAction title="تم" onPress={() => setPanel(null)} /></ScrollView></Modal>
  </GameShell>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/Trix.tsx; confidence medium; todos 1 native complete session verification.
