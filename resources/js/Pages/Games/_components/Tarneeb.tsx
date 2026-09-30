import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { SUIT_LABEL, type Card, type Suit } from '../_lib/cards';
import { applyRound, createMatch, isMatchOver, type MatchState } from '../_lib/cardGames/match';
import { power } from '../_lib/cardGames/hand';
import {
  DEFAULT_TARNEEB,
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
import PlayingCard from './PlayingCard';

/** Seat 0 is the player; 1 west, 2 north (the partner), 3 east. */
const HUMAN = 0;
const SEAT_NAMES = ['أنت', 'غرب', 'شريكك', 'شرق'];
const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
/** How long an AI seat "thinks" before acting, so the table is followable. */
const AI_DELAY = 700;

const createFreshMatch = () =>
  createMatch({ players: TARNEEB_PLAYERS, units: TARNEEB_TEAMS, target: DEFAULT_TARNEEB.target });

export default function Tarneeb() {
  const [match, setMatch] = useState<MatchState | null>(null);
  const [round, setRound] = useState<TarneebRound | null>(null);

  useEffect(() => {
    const fresh = createFreshMatch();
    setMatch(fresh);
    setRound(createRound(DEFAULT_TARNEEB, fresh.dealer));
  }, []);

  // An AI seat acts on its turn after a beat. Guarded against a stale state so a
  // fast human tap cannot be overwritten.
  useEffect(() => {
    if (!round || round.phase === 'complete') return;
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
  }, [round]);

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
  const legal = round.phase === 'playing' && humanTurn ? legalPlays(round, HUMAN) : [];
  const legalIds = new Set(legal.map((card) => card.id));

  const play = (card: Card) => {
    if (!legalIds.has(card.id)) return;
    setRound((current) => (current ? playCard(current, HUMAN, card) : current));
  };
  const placeBid = (value: number) => setRound((current) => (current ? bid(current, HUMAN, value) : current));
  const doPass = () => setRound((current) => (current ? pass(current, HUMAN) : current));
  const nameTrump = (suit: Suit) => setRound((current) => (current ? engineChooseTrump(current, HUMAN, suit) : current));

  const nextRound = () => {
    if (!round || round.phase !== 'complete') return;
    const advanced = applyRound(match, isRedeal(round) ? [0, 0] : scoreRound(round));
    setMatch(advanced);
    if (!isMatchOver(advanced)) setRound(createRound(DEFAULT_TARNEEB, advanced.dealer));
  };
  const newGame = () => {
    const fresh = createFreshMatch();
    setMatch(fresh);
    setRound(createRound(DEFAULT_TARNEEB, fresh.dealer));
  };

  const playedBy = (seat: number) => round.trick.find((play) => play.seat === seat)?.card;
  const lastAction = (seat: number) => {
    const actions = round.auction.actions.filter((action) => action.seat === seat);
    const last = actions[actions.length - 1];
    if (!last) return null;
    return 'pass' in last ? 'تمرير' : String(last.value);
  };

  const you = teamOf(HUMAN);
  const them = you === 0 ? 1 : 0;

  return (
    <div className="select-none">
      <div className="mb-3 flex items-stretch gap-2 text-center">
        <Score label="فريقك" value={match.scores[you]} tone="primary" />
        <Score label="الخصوم" value={match.scores[them]} />
        <Score label="الهدف" value={match.options.target} />
        <Score label="الجولة" value={match.round + 1} />
        <Button variant="outline" onClick={newGame} className="flex h-auto flex-col gap-1 rounded-xl px-3 py-2">
          <RefreshCw className="h-4 w-4" />
          <span className="text-[11px] font-bold">جديد</span>
        </Button>
      </div>

      {round.declarer !== null && (
        <p className="mb-2 text-center text-xs font-bold text-muted-foreground">
          العقد {round.auction.highBid} على {SEAT_NAMES[round.declarer]}
          {round.trump && <> · حكم {SUIT_LABEL[round.trump]}</>} · أخذنا {round.tricks[you]} و{round.tricks[them]}
        </p>
      )}

      <div className="sz-tar" dir="ltr">
        <div className="sz-tar__board">
          <Seat name={SEAT_NAMES[2]} count={round.hands[2].length} action={lastAction(2)} className="sz-tar__seat--north" />

          <Seat name={SEAT_NAMES[1]} count={round.hands[1].length} action={lastAction(1)} className="sz-tar__seat--west" />

          <div className="sz-tar__trick">
            <Slot position="n" card={playedBy(2)} />
            <Slot position="w" card={playedBy(1)} />
            <div className="sz-tar__slot sz-tar__slot--c">
              {round.trump ? <span className="sz-tar__trump">{SUIT_LABEL[round.trump]}</span> : null}
            </div>
            <Slot position="e" card={playedBy(3)} />
            <Slot position="s" card={playedBy(HUMAN)} />
          </div>

          <Seat name={SEAT_NAMES[3]} count={round.hands[3].length} action={lastAction(3)} className="sz-tar__seat--east" />
        </div>

        <div className="sz-tar__hand">
          {hand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              interactive={legalIds.has(card.id)}
              className={legalIds.has(card.id) ? 'sz-tar__playable' : ''}
              onClick={() => play(card)}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 text-center">
        {round.phase === 'bidding' && (
          <Bidding
            turn={round.turn}
            high={round.auction.highBid}
            options={legalBids(round)}
            onBid={placeBid}
            onPass={doPass}
          />
        )}

        {round.phase === 'trump' && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {round.declarer === HUMAN ? (
              <>
                <span className="text-sm font-bold">اختر الحكم:</span>
                {SUITS.map((suit) => (
                  <button key={suit} type="button" onClick={() => nameTrump(suit)} className="sz-tar__suit">
                    {SUIT_LABEL[suit]}
                  </button>
                ))}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">يختار {SEAT_NAMES[round.declarer ?? 0]} الحكم…</span>
            )}
          </div>
        )}

        {round.phase === 'playing' && (
          <span className="text-sm text-muted-foreground">
            {humanTurn ? 'دورك — العب ورقة' : `دور ${SEAT_NAMES[round.turn ?? 0]}…`}
          </span>
        )}

        {round.phase === 'complete' && (
          <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-4">
            {isRedeal(round) ? (
              <p className="text-sm font-bold">الكل تمرير — إعادة التوزيع</p>
            ) : (
              <p className="text-sm font-bold">
                {SEAT_NAMES[round.declarer ?? 0]} عقد {round.auction.highBid} بأخذ {round.tricks[teamOf(round.declarer ?? 0)]}
                {' · '}
                {scoreRound(round)[you] > 0 ? 'نجح العقد' : 'فشل العقد'}
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
                الجولة التالية
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
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
        {high === null ? `يفتح ${SEAT_NAMES[turn ?? 0]}…` : `أعلى مزايدة ${high} — دور ${SEAT_NAMES[turn ?? 0]}…`}
      </span>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm font-bold">زايد:</span>
      {options.map((value) => (
        <button key={value} type="button" onClick={() => onBid(value)} className="sz-tar__bid">
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
  className = '',
}: {
  name: string;
  count: number;
  action: string | null;
  className?: string;
}) {
  return (
    <div className={`sz-tar__seat ${className}`}>
      <span className="sz-tar__seat-name">{name}</span>
      <div className="sz-tar__seat-card">
        <div className="sz-card sz-card--back">
          <span className="sz-card__count">{count}</span>
        </div>
      </div>
      {action !== null && <span className="sz-tar__seat-bid">{action}</span>}
    </div>
  );
}

function Slot({ position, card }: { position: string; card?: Card }) {
  return (
    <div className={`sz-tar__slot sz-tar__slot--${position}`}>
      {card && <PlayingCard card={card} decorative />}
    </div>
  );
}
