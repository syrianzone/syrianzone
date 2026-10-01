import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { SUIT_LABEL, type Card, type Suit } from '../_lib/cards';
import { applyRound, createMatch, isMatchOver, type MatchState } from '../_lib/cardGames/match';
import { power } from '../_lib/cardGames/hand';
import { readStats, recordMatch, type MatchStats } from '../_lib/scores';
import { readLargeCards, writeLargeCards } from '../_lib/cardDisplay';
import {
  DEFAULT_TARNEEB,
  TARNEEB_HAND,
  TARNEEB_PLAYERS,
  TARNEEB_TEAMS,
  bid,
  chooseTrump as engineChooseTrump,
  createRound,
  isRedeal,
  legalBids,
  legalPlays,
  pass,
  playCard,
  scoreRound,
  teamOf,
  type TarneebRound,
} from '../_lib/tarneeb';
import { chooseBid, choosePlay, chooseTrump } from '../_lib/tarneebAi';
import { DialogClose } from '@/Components/ui/dialog';
import PlayingCard from './PlayingCard';
import CardStyleToggle from './CardStyleToggle';
import GameMenu from './GameMenu';

/** Seat 0 is the player; 1 on the left, 2 opposite (the partner), 3 on the right. */
const HUMAN = 0;
const SEAT_NAMES = ['أنت', 'يسارك', 'شريكك', 'يمينك'];
/** The seats said as "from …", since "أنت" has no such form ("من أنت" is wrong). */
const SEAT_FROM = ['منك', 'من يسارك', 'من شريكك', 'من يمينك'];
const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
/** How long an AI seat "thinks" before acting, so the table is followable. */
const AI_DELAY = 750;

const createFreshMatch = () =>
  createMatch({ players: TARNEEB_PLAYERS, units: TARNEEB_TEAMS, target: DEFAULT_TARNEEB.target });

const EMPTY_STATS: MatchStats = { played: 0, wins: 0, losses: 0, draws: 0 };

export default function Tarneeb() {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [round, setRound] = useState<TarneebRound | null>(null);
  const [stats, setStats] = useState<MatchStats>(EMPTY_STATS);
  /** A completed trick stays on the table until the player says continue. */
  const [paused, setPaused] = useState(false);
  /** The card under the finger/mouse while dragging it out to play. */
  const [ghost, setGhost] = useState<{ card: Card; x: number; y: number; w: number } | null>(null);
  /** Draw every card as one big rank instead of pips. */
  const [large, setLarge] = useState(false);

  const recorded = useRef<MatchState | null>(null);
  const seenHistory = useRef(0);
  const drag = useRef<{
    card: Card;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    w: number;
    active: boolean;
  } | null>(null);

  useEffect(() => {
    const fresh = createFreshMatch();
    setMatch(fresh);
    setRound(createRound(DEFAULT_TARNEEB, fresh.dealer));
    setStats(readStats('tarneeb'));
    setLarge(readLargeCards());
  }, []);

  // One effect drives the whole table: it holds a just-completed trick for the
  // player, and otherwise lets the next AI seat act after a beat.
  useEffect(() => {
    if (!round) return;
    if (round.phase === 'playing' && round.history.length > seenHistory.current) {
      seenHistory.current = round.history.length;
      setPaused(true);
      return;
    }
    seenHistory.current = round.history.length;
    if (paused || round.phase === 'complete') return;
    const seat = round.turn;
    if (seat === null || seat === HUMAN) return;
    const timer = window.setTimeout(() => {
      setRound((current) => {
        if (!current || current !== round) return current;
        if (current.phase === 'bidding') {
          const value = chooseBid(current, seat);
          return value === null ? pass(current, seat) : bid(current, seat, value);
        }
        if (current.phase === 'trump') return engineChooseTrump(current, seat, chooseTrump(current, seat));
        if (current.phase === 'playing') return playCard(current, seat, choosePlay(current, seat));
        return current;
      });
    }, AI_DELAY);
    return () => window.clearTimeout(timer);
  }, [round, paused]);

  useEffect(() => {
    if (!match || !isMatchOver(match) || recorded.current === match) return;
    recorded.current = match;
    setStats(recordMatch('tarneeb', match.winner === teamOf(HUMAN) ? 'win' : 'loss'));
  }, [match]);

  const hand = useMemo(() => {
    if (!round) return [];
    return [...round.hands[HUMAN]].sort(
      (a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || power(b) - power(a),
    );
  }, [round]);

  if (!match || !round) {
    return <div className="py-16 text-center text-sm text-muted-foreground">جاري التوزيع…</div>;
  }

  const humanTurn = round.turn === HUMAN;
  const canPlay = round.phase === 'playing' && humanTurn && !paused;
  const legal = canPlay ? legalPlays(round, HUMAN) : [];
  const legalIds = new Set(legal.map((card) => card.id));

  const play = (card: Card) => {
    if (!legalIds.has(card.id)) return;
    setRound((current) => (current ? playCard(current, HUMAN, card) : current));
  };
  const placeBid = (value: number) => setRound((current) => (current ? bid(current, HUMAN, value) : current));
  const doPass = () => setRound((current) => (current ? pass(current, HUMAN) : current));
  const nameTrump = (suit: Suit) =>
    setRound((current) => (current ? engineChooseTrump(current, HUMAN, suit) : current));
  const proceed = () => setPaused(false);

  const nextRound = () => {
    if (round.phase !== 'complete') return;
    const advanced = applyRound(match, isRedeal(round) ? [0, 0] : scoreRound(round));
    setMatch(advanced);
    seenHistory.current = 0;
    setPaused(false);
    if (!isMatchOver(advanced)) setRound(createRound(DEFAULT_TARNEEB, advanced.dealer));
  };
  const newGame = () => {
    const fresh = createFreshMatch();
    recorded.current = null;
    seenHistory.current = 0;
    setPaused(false);
    setMatch(fresh);
    setRound(createRound(DEFAULT_TARNEEB, fresh.dealer));
  };

  const toggleLarge = () =>
    setLarge((value) => {
      writeLargeCards(!value);
      return !value;
    });

  // Card drag: a legal card can be pulled out and dropped on the table to play,
  // or tapped. Only a real drag swallows the following click.
  const startDrag = (card: Card, e: React.PointerEvent) => {
    if (!legalIds.has(card.id)) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    drag.current = {
      card,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      w: rect.width,
      active: false,
    };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active) {
        if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 8) return;
        d.active = true;
      }
      if (ev.cancelable) ev.preventDefault();
      setGhost({ card: d.card, x: ev.clientX - d.grabX, y: ev.clientY - d.grabY, w: d.w });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const d = drag.current;
      drag.current = null;
      setGhost(null);
      if (!d?.active) return; // a tap falls through to onClick
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const onTable = under instanceof Element && under.closest('.sz-tbl') !== null;
      const swallow = (ce: Event) => {
        ce.stopPropagation();
        ce.preventDefault();
        window.removeEventListener('click', swallow, true);
      };
      window.addEventListener('click', swallow, true);
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 500);
      if (onTable) play(d.card);
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const trick = paused && round.history.length > 0 ? round.history[round.history.length - 1].plays : round.trick;
  const trickWinnerSeat = paused && round.history.length > 0 ? round.history[round.history.length - 1].winner : null;
  const cardAt = (seat: number) => trick.find((play) => play.seat === seat)?.card;

  const you = teamOf(HUMAN);
  const them = you === 0 ? 1 : 0;
  const declTeam = round.declarer !== null ? teamOf(round.declarer) : null;
  const declTricks = declTeam !== null ? round.tricks[declTeam] : 0;
  const made = declTeam !== null && declTricks >= (round.auction.highBid ?? 0);
  const swept = declTricks >= TARNEEB_HAND;
  // Second person when the declarer is you: "أنت طلبت ٨ وأكلت ٩".
  const bidVerb = round.declarer === HUMAN ? 'طلبت' : 'طلب';
  const tookVerb = round.declarer === HUMAN ? 'وأكلت' : 'وأكل';
  const roundPoints = round.phase === 'complete' && !isRedeal(round) ? scoreRound(round) : null;
  const lastAction = (seat: number) => {
    const actions = round.auction.actions.filter((action) => action.seat === seat);
    const last = actions[actions.length - 1];
    if (!last) return '';
    return 'pass' in last ? 'مرّر' : String(last.value);
  };

  return (
    <div className="flex h-full select-none flex-col">
      {/* The two buttons portal into the shell header, beside القوانين. Only the
          contract line stays here; its height is reserved so the table never
          moves as the contract appears. */}
      <GameMenu
        stats={
          <div className="space-y-3">
            <div className="flex items-stretch gap-2 text-center">
              <Score label="فريقك" value={match.scores[you]} tone="primary" />
              <Score label="الخصوم" value={match.scores[them]} />
              <Score label="الهدف" value={match.options.target} />
              <Score label="الدست" value={match.round + 1} />
            </div>
            <p className="text-center text-xs font-bold text-muted-foreground">
              نتائجك: {stats.wins} فوز · {stats.losses} خسارة
            </p>
          </div>
        }
        options={
          <div className="space-y-3">
            <div className="flex items-stretch gap-2">
              <CardStyleToggle large={large} onToggle={toggleLarge} />
              <DialogClose asChild>
                <Button variant="outline" onClick={newGame} className="flex h-auto flex-1 flex-col gap-1 rounded-xl px-3 py-2">
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-[11px] font-bold">جديد</span>
                </Button>
              </DialogClose>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              «أرقام» يبدّل شكل الورق بين الأنماط والرتب الكبيرة. «جديد» يبدأ مباراة جديدة.
            </p>
          </div>
        }
      />

      <p className="mb-2 min-h-[1.25rem] shrink-0 text-center text-xs font-bold text-muted-foreground">
        {round.declarer !== null ? (
          <>
            الطلب {round.auction.highBid} {SEAT_FROM[round.declarer]}
            {round.trump && <> · الحكم {SUIT_LABEL[round.trump]}</>} · طرنيبنا {round.tricks[you]} وطرنيبهم{' '}
            {round.tricks[them]}
          </>
        ) : (
          ' '
        )}
      </p>

      <div className="sz-tbl" dir="ltr">
        <Seat name={SEAT_NAMES[2]} count={round.hands[2].length} action={lastAction(2)} orientation="h" className="sz-tbl__seat--north" />
        <Seat name={SEAT_NAMES[1]} count={round.hands[1].length} action={lastAction(1)} orientation="v" className="sz-tbl__seat--west" />
        <Seat name={SEAT_NAMES[3]} count={round.hands[3].length} action={lastAction(3)} orientation="v" className="sz-tbl__seat--east" />

        <div className="sz-tbl__centre">
          <div className="sz-tbl__trick">
            <Slot position="n" card={cardAt(2)} win={trickWinnerSeat === 2} large={large} />
            <Slot position="w" card={cardAt(1)} win={trickWinnerSeat === 1} large={large} />
            <div className="sz-tbl__slot sz-tbl__slot--c">
              {round.trump ? <span className="sz-tbl__trump">{SUIT_LABEL[round.trump]}</span> : null}
            </div>
            <Slot position="e" card={cardAt(3)} win={trickWinnerSeat === 3} large={large} />
            <Slot position="s" card={cardAt(HUMAN)} win={trickWinnerSeat === HUMAN} large={large} />
          </div>
        </div>

        <div className="sz-tbl__hand">
          {hand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              large={large}
              interactive={legalIds.has(card.id)}
              className={legalIds.has(card.id) ? 'sz-tbl__playable' : ''}
              onClick={() => play(card)}
            />
          ))}
        </div>
      </div>

      {/* A fixed-height action strip, so the board above it never shifts. */}
      <div className="sz-tbl__actions mt-2 shrink-0">
        {paused ? (
          <Button onClick={proceed}>كمّل</Button>
        ) : round.phase === 'bidding' ? (
          <Bidding
            turn={round.turn}
            high={round.auction.highBid}
            options={legalBids(round)}
            onBid={placeBid}
            onPass={doPass}
          />
        ) : round.phase === 'trump' ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {round.declarer === HUMAN ? (
              <>
                <span className="text-sm font-bold">اختر الحكم:</span>
                {SUITS.map((suit) => (
                  <button key={suit} type="button" onClick={() => nameTrump(suit)} className="sz-tbl__suit">
                    {SUIT_LABEL[suit]}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">يختار {SEAT_NAMES[round.declarer ?? 0]} الحكم…</span>
            )}
          </div>
        ) : round.phase === 'playing' ? (
          <span className="text-sm text-muted-foreground">
            {humanTurn ? 'دورك — نزّل ورقة' : `دور ${SEAT_NAMES[round.turn ?? 0]}…`}
          </span>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-4">
            {isRedeal(round) ? (
              <p className="text-sm font-bold">الكل مرّر — إعادة التوزيع</p>
            ) : (
              <p className="text-sm font-bold">
                {SEAT_NAMES[round.declarer ?? 0]} {bidVerb} {round.auction.highBid} {tookVerb} {declTricks}
                {' · '}
                {made ? 'نجح الطلب' : 'فشل الطلب'}
                {swept && ' · كبوت!'}
                {roundPoints && (
                  <>
                    {' · '}لنا {roundPoints[you]} ولهم {roundPoints[them]}
                  </>
                )}
              </p>
            )}
            {isMatchOver(match) ? (
              <div className="mt-3">
                <p className="mb-2 text-lg font-black text-primary">
                  {match.winner === you ? 'فزتم بالمباراة!' : 'خسرتم المباراة'}
                </p>
                <Button onClick={newGame}>لعبة جديدة</Button>
              </div>
            ) : (
              <Button onClick={nextRound} className="mt-3">
                الدست الجاي
              </Button>
            )}
          </div>
        )}
      </div>

      {/* The card following the finger while it is dragged out to play. */}
      {ghost && (
        <div
          className="sz-tbl__ghost"
          style={
            {
              left: ghost.x,
              top: ghost.y,
              width: ghost.w,
              '--sz-card-w': `${ghost.w}px`,
              '--sz-card-h-ratio': 1.4286,
            } as React.CSSProperties
          }
        >
          <PlayingCard card={ghost.card} decorative large={large} />
        </div>
      )}
    </div>
  );
}

export function TarneebRules() {
  return (
    <>
      <ul className="list-disc space-y-1 ps-5">
        <li>أربعة لاعبين في فريقين، والشريك يجلس مقابلًا لك.</li>
        <li>تُوزَّع الأوراق كلها، ١٣ ورقة لكل لاعب.</li>
        <li>
          المزايدة من ٧ إلى ١٣، وكل مزايدة أعلى من التي قبلها. إن لم ترغب بالمزايدة مرّر دورك، ومن يفز
          بالطلب يختار الحكم.
        </li>
        <li>يبدأ الطالب باللعب، ويجب أن تتبع اللون إن كان معك؛ وإن لم يكن معك فيجوز أن تلعب أي ورقة.</li>
        <li>الحكم يتقدّم على أي ورقة، وإن لم يُلعَب حكم يفوز أعلى ورقة من اللون المطلوب.</li>
        <li>إن أكل الطالب عدد الطرانيب الذي طلبه سجّل عددها، وإن قصّر سجّل الخصوم قيمة الطلب.</li>
        <li>
          الكبوت: من يطلب ١٣ ويأخذها كلها سجّل ٢٦، وإن فشل خسر ١٦ وسجّل الخصوم ضعف طرنيبهم. ومن يأخذ
          الطرانيب الثلاث عشرة على طلب أقل يُكافأ بثلاث نقاط زيادة.
        </li>
        <li>أول فريق يبلغ ٤١ نقطة يفوز بالمباراة.</li>
      </ul>
    </>
  );
}

function Bidding({
  turn,
  high,
  options,
  onBid,
  onPass,
}: {
  turn: number | null;
  high: number | null;
  options: number[];
  onBid: (value: number) => void;
  onPass: () => void;
}) {
  if (turn !== HUMAN) {
    return (
      <span className="text-sm text-muted-foreground">
        {high === null ? `يفتح ${SEAT_NAMES[turn ?? 0]}…` : `أعلى طلب ${high} — دور ${SEAT_NAMES[turn ?? 0]}…`}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm font-bold">زايد:</span>
      {options.map((value) => (
        <button key={value} type="button" onClick={() => onBid(value)} className="sz-tbl__bid">
          {value}
        </button>
      ))}
      <Button variant="outline" size="sm" onClick={onPass}>
        تمرير
      </Button>
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone?: 'primary' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-card/60 px-2 py-2">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <span className={`font-mono text-base font-black tabular-nums ${tone === 'primary' ? 'text-primary' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Seat({
  name,
  count,
  action,
  orientation,
  className = '',
}: {
  name: string;
  count: number;
  action: string;
  orientation: 'h' | 'v';
  className?: string;
}) {
  return (
    <div className={`sz-tbl__seat ${className}`}>
      <span className="sz-tbl__seat-name">{name}</span>
      <div className={`sz-tbl__seat-hand sz-tbl__seat-hand--${orientation}`}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="sz-card sz-card--back" aria-hidden="true" />
        ))}
      </div>
      <span className="sz-tbl__seat-bid">{action}</span>
    </div>
  );
}

function Slot({ position, card, win, large }: { position: string; card?: Card; win: boolean; large: boolean }) {
  return (
    <div className={`sz-tbl__slot sz-tbl__slot--${position} ${win ? 'sz-tbl__slot--win' : ''}`}>
      {card && <PlayingCard card={card} decorative large={large} />}
    </div>
  );
}
