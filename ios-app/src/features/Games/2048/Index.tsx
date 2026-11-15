import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, View, useWindowDimensions } from 'react-native';
import type { Direction } from '../engines';
import { Label, Section } from '../../../components';
import { NativeAction } from '../../../ui/native';
import { useTheme } from '../../../ui/theme';
import type { NativeShortcut } from '../../../platform/NativeKeyCommands';
import { GameShell } from '../GameShell';
import { useGameRecords } from '../records';
import { Game2048Board, use2048ReducedMotion } from './Board';
import { advanceRound, clearGhosts, continueRound, MOTION_2048, newRound } from './motion';
const RULES = ['اسحب في الاتجاه المطلوب لدمج المربعات المتساوية. تجمع قيمة كل اندماج إلى النقاط.', 'الهدف بلوغ ٢٠٤٨، ويمكن متابعة اللعب بعده.', 'تنتهي الجولة عندما لا تبقى حركة ممكنة. تحفظ أفضل نتيجة على جهازك.'];
const KEY_DIRECTIONS: Partial<Record<NativeShortcut, Direction>> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
const KEY_COMMANDS = Object.keys(KEY_DIRECTIONS) as NativeShortcut[];
export function Game2048Screen(): React.JSX.Element {
  const id = useRef(1);
  const nextId = (): number => id.current++;
  const [round, setRound] = useState(() => newRound(nextId)), [restartCount, setRestartCount] = useState(0);
  const current = useRef(round), ghostEpoch = useRef(0), ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { board, score, phase } = round;
  const reducedMotion = use2048ReducedMotion();
  const records = useGameRecords();
  const saveBest = useRef(records.best); saveBest.current = records.best;
  const { colors } = useTheme();
  const size = Math.min(useWindowDimensions().width - 36, 440);
  const play = (direction: Direction): void => {
    const next = advanceRound(current.current, direction, nextId);
    if (next === current.current) return;
    if (next.ghostRevision !== current.current.ghostRevision) {
      // A queued old callback must not consume this merge before React flushes its effects.
      ghostEpoch.current++; if (ghostTimer.current !== null) clearTimeout(ghostTimer.current); ghostTimer.current = null;
    }
    current.current = next; setRound(next);
  };
  const playRef = useRef(play); playRef.current = play;
  const pan = useMemo(() => PanResponder.create({ onStartShouldSetPanResponder: () => true, onPanResponderTerminationRequest: () => false,
    onMoveShouldSetPanResponder: (_event, g) => Math.max(Math.abs(g.dx), Math.abs(g.dy)) > 24,
    onPanResponderRelease: (_event, g) => { if (Math.max(Math.abs(g.dx), Math.abs(g.dy)) >= 24) playRef.current(Math.abs(g.dx) > Math.abs(g.dy) ? g.dx > 0 ? 'right' : 'left' : g.dy > 0 ? 'down' : 'up'); } }), []);
  useEffect(() => { if (score > 0) saveBest.current('2048', score); }, [score]);
  useEffect(() => {
    let active = true;
    const epoch = ++ghostEpoch.current;
    if (reducedMotion !== false) {
      const settled = clearGhosts(current.current);
      if (settled !== current.current) { current.current = settled; setRound(settled); }
      return;
    }
    if (current.current.ghosts.length) ghostTimer.current = setTimeout(() => {
      if (!active || epoch !== ghostEpoch.current) return;
      const settled = clearGhosts(current.current); current.current = settled; setRound(settled); ghostTimer.current = null;
    }, MOTION_2048.ghostLifetime);
    return () => { active = false; if (ghostTimer.current !== null) clearTimeout(ghostTimer.current); ghostTimer.current = null; };
  }, [round.ghostRevision, restartCount, reducedMotion]);
  const restart = (): void => {
    ghostEpoch.current++; if (ghostTimer.current !== null) clearTimeout(ghostTimer.current); ghostTimer.current = null;
    const next = newRound(nextId); current.current = next; setRound(next); setRestartCount(value => value + 1);
  };
  return <GameShell title="2048" rules={RULES} actions={<NativeAction title="لعبة جديدة" systemImage="arrow.clockwise" onPress={restart} />}
    keyboardCommands={{ commands: KEY_COMMANDS, physicalDirections: true, active: phase === 'playing', onKey: key => { const direction = KEY_DIRECTIONS[key]; if (direction) playRef.current(direction); } }}>
    <Section><Label>النقاط {score}    أفضل نتيجة {records.records.best2048}</Label>{records.error ? <Label style={{ color: colors.danger }}>{records.error}</Label> : null}</Section>
    <Game2048Board board={reducedMotion === null ? [] : board} ghosts={round.ghosts} size={size} reducedMotion={reducedMotion !== false} panHandlers={pan.panHandlers} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>{([{ direction: 'up', title: 'أعلى' }, { direction: 'right', title: 'يمين' }, { direction: 'down', title: 'أسفل' }, { direction: 'left', title: 'يسار' }] as const).map(button => <Pressable key={button.direction} accessibilityRole="button" accessibilityLabel={`تحريك ${button.title}`} onPress={() => play(button.direction)} style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surface }}><Label>{button.title}</Label></Pressable>)}</View>
    {phase === 'won' ? <Section><Label>وصلت إلى ٢٠٤٨!</Label><NativeAction title="متابعة اللعب" onPress={() => { const next = continueRound(current.current); current.current = next; setRound(next); }} /></Section> : phase === 'lost' ? <Section><Label>انتهت الجولة.</Label><NativeAction title="لعبة جديدة" onPress={restart} /></Section> : null}
  </GameShell>;
}
// PORT STATUS: source resources/js/Pages/Games/_components/Game2048.tsx; confidence high; todos 2 observed native keyboard and motion verification.
