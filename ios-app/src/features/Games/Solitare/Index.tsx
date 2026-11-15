import { useIsFocused } from '@react-navigation/native';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { AppState, Pressable, View, useWindowDimensions } from 'react-native';
import { Label, Section } from '../../../components';
import { NativeAction } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import { GameShell } from '../GameShell';
import { PlayingCard, type DropPoint } from '../PlayingCard';
import { solitaire, type Deal, type Destination, type Source } from '../engines';
import { useGameRecords } from '../records';
const RULES = ['رتب الأساسات الأربعة من الآس إلى الملك حسب اللون.', 'الأعمدة تنازلية بألوان متناوبة. الملك وحده يبدأ عموداً فارغاً.', 'اسحب ورقة من المخزون وأعد تدوير البساط عند نفاده.', 'انقر الورقة ثم الوجهة، أو اسحبها. التراجع والتلميح متاحان. أفضل وقت محفوظ على جهازك.'];
export function SolitaireScreen(): React.JSX.Element {
  const [deal, setDeal] = useState(() => solitaire.createDeal());
  const current = useRef(deal); current.current = deal;
  const [history, setHistory] = useState<Deal[]>([]);
  const [selected, setSelected] = useState<Source | null>(null);
  const [hint, setHint] = useState<ReturnType<typeof solitaire.availableMoves>[number] | null>(null);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [notice, setNotice] = useState<string | null>(null);
  const targets = useRef(new Map<string, ComponentRef<typeof View>>());
  const records = useGameRecords();
  const saveBest = useRef(records.best); saveBest.current = records.best;
  const won = solitaire.isWon(deal);
  const recorded = useRef(false);
  const { colors } = useTheme();
  const width = Math.max(37, Math.min(74, (useWindowDimensions().width - 60) / 7));
  useEffect(() => { const sub = AppState.addEventListener('change', state => setActive(state === 'active')); return () => sub.remove(); }, []);
  useEffect(() => { if (!active || !focused || won) return; const timer = setInterval(() => setElapsed(value => value + 1), 1000); return () => clearInterval(timer); }, [active, focused, won]);
  useEffect(() => { if (won && !recorded.current) { recorded.current = true; saveBest.current('solitare', elapsed); } }, [won, elapsed]);
  const commit = (next: Deal): void => { const before = current.current; if (next === before) return; setHistory(previous => [...previous, before]); current.current = next; setDeal(next); setMoves(value => value + 1); setSelected(null); setHint(null); setNotice(null); };
  const tryMove = (from: Source, to: Destination): void => { if (solitaire.canMove(current.current, from, to)) commit(solitaire.applyMove(current.current, from, to)); else setNotice('لا يمكن نقل الورقة إلى هذه الخانة.'); };
  const destination = (to: Destination): void => { if (selected) tryMove(selected, to); };
  const choose = (from: Source): void => {
    if (selected && from.kind === 'tableau' && (selected.kind !== 'tableau' || selected.column !== from.column)) { tryMove(selected, { kind: 'tableau', column: from.column }); return; }
    if (solitaire.liftable(current.current, from)) setSelected(previous => JSON.stringify(previous) === JSON.stringify(from) ? null : from);
  };
  const drop = (from: Source, point: DropPoint): void => {
    const refs = [...targets.current.entries()];
    void Promise.all(refs.map(([key, node]) => new Promise<{ key: string; x: number; y: number; w: number; h: number }>(resolve => node.measureInWindow((x, y, w, h) => resolve({ key, x, y, w, h }))))).then(rects => {
      const hit = rects.find(rect => point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h);
      if (!hit) return;
      const [kind, raw] = hit.key.split(':'); const index = Number(raw);
      tryMove(from, kind === 'f' ? { kind: 'foundation', index } : { kind: 'tableau', column: index });
    });
  };
  const track = (key: string) => (node: ComponentRef<typeof View> | null): void => { if (node) targets.current.set(key, node); else targets.current.delete(key); };
  const restart = (): void => { const fresh = solitaire.createDeal(); current.current = fresh; setDeal(fresh); setHistory([]); setMoves(0); setElapsed(0); setSelected(null); setHint(null); setNotice(null); recorded.current = false; };
  const undo = (): void => { const previous = history.at(-1); if (!previous) return; current.current = previous; setDeal(previous); setHistory(values => values.slice(0, -1)); setMoves(value => Math.max(0, value - 1)); setSelected(null); setHint(null); };
  const showHint = (): void => { const available = solitaire.availableMoves(current.current); const move = available.find(value => value.to.kind === 'foundation') ?? available[0] ?? null; setHint(move); setSelected(move?.from ?? null); setNotice(move ? 'الورقة المحددة يمكن نقلها إلى الخانة المضيئة.' : solitaire.canDraw(current.current) ? 'اسحب ورقة من المخزون.' : 'لا توجد حركات متاحة.'); };
  const waste = deal.waste.at(-1);
  return <GameShell title="سوليتير" rules={RULES} actions={<View style={{ gap: 8 }}><View style={{ flexDirection: 'row', gap: 8 }}><View style={{ flex: 1 }}><NativeAction title="تراجع" disabled={!history.length} systemImage="arrow.uturn.backward" onPress={undo} /></View><View style={{ flex: 1 }}><NativeAction title="تلميح" systemImage="lightbulb" onPress={showHint} /></View></View><NativeAction title="لعبة جديدة" systemImage="arrow.clockwise" onPress={restart} /><NativeAction title={records.records.largeCards ? 'إظهار الأنماط' : 'أرقام كبيرة'} onPress={() => records.large(!records.records.largeCards)} /></View>}>
    <Section><Label>الحركات {moves}    الوقت {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}</Label><Label secondary>أفضل وقت {records.records.bestSolitaireSeconds || 'لم يسجل'}</Label>{records.error ? <Label style={{ color: colors.danger }}>{records.error}</Label> : null}{notice ? <Label>{notice}</Label> : null}</Section>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 3, direction: 'ltr' }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`المخزون، ${deal.stock.length} ورقة، اسحب ورقة`} onPress={() => commit(solitaire.drawStock(current.current))} style={{ width, minHeight: width * 1.46, borderRadius: 7, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}><Label>{deal.stock.length ? 'سحب' : 'إعادة'}</Label></Pressable>
      <View style={{ width }}>{waste ? <PlayingCard card={waste} width={width} large={records.records.largeCards} selected={selected?.kind === 'waste'} onPress={() => choose({ kind: 'waste' })} onDrop={point => drop({ kind: 'waste' }, point)} /> : <Label secondary>البساط</Label>}</View><View style={{ width: 3 }} />
      {deal.foundations.map((pile, index) => <View key={index} ref={track(`f:${index}`)} collapsable={false} style={{ width, minHeight: width * 1.46, borderWidth: hint?.to.kind === 'foundation' && hint.to.index === index ? 3 : 1, borderColor: colors.accent, borderRadius: 7 }}><Pressable accessibilityRole="button" accessibilityLabel={`الأساس ${index + 1}، ${pile.length} ورقة`} onPress={() => destination({ kind: 'foundation', index })} style={{ flex: 1, minHeight: width * 1.46 }}>{pile.at(-1) ? <PlayingCard card={pile.at(-1)!} width={width - 2} large={records.records.largeCards} onPress={() => selected ? destination({ kind: 'foundation', index }) : choose({ kind: 'foundation', index })} onDrop={point => drop({ kind: 'foundation', index }, point)} /> : <Label secondary>آس</Label>}</Pressable></View>)}
    </View>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 3, direction: 'ltr', minHeight: 400 }}>
      {deal.tableau.map((column, columnIndex) => <View key={columnIndex} ref={track(`t:${columnIndex}`)} collapsable={false} style={{ width, minHeight: 400, borderRadius: 7, borderWidth: hint?.to.kind === 'tableau' && hint.to.column === columnIndex ? 2 : 0, borderColor: colors.accent }}><Pressable accessibilityRole="button" accessibilityLabel={`العمود ${columnIndex + 1}، ${column.length} ورقة`} onPress={() => destination({ kind: 'tableau', column: columnIndex })} style={{ flex: 1, minHeight: 400 }}>
        {!column.length ? <Label secondary>ملك</Label> : null}{column.map((card, cardIndex) => { const from: Source = { kind: 'tableau', column: columnIndex, cardIndex }; return <View key={card.id} style={{ position: 'absolute', top: cardIndex * width * 0.42, zIndex: cardIndex }}><PlayingCard card={card} width={width} large={records.records.largeCards} selected={selected?.kind === 'tableau' && selected.column === columnIndex && cardIndex >= selected.cardIndex} onPress={() => choose(from)} onDrop={point => drop(from, point)} /></View>; })}
      </Pressable></View>)}
    </View>
    {won ? <Section><Label>مبروك! اكتملت الأساسات الأربعة.</Label><NativeAction title="لعبة جديدة" onPress={restart} /></Section> : <NativeAction title="نقل الأوراق الآمنة إلى الأساسات" disabled={!solitaire.availableMoves(deal).some(move => move.to.kind === 'foundation')} onPress={() => commit(solitaire.autoMove(current.current))} />}
  </GameShell>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/Solitaire.tsx; confidence medium; todos 1 native seven-column drag and card accessibility verification.
