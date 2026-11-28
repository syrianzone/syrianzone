import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { RANK_LABEL, SUIT_LABEL, SUIT_NAME_AR, cardName, type Card, type Suit } from '@/Domain/games/cards';
import { power } from '../_lib/cardGames/hand';
import type { Play } from '../_lib/cardGames/trick';
import { readLargeCards, writeLargeCards } from '../_lib/cardDisplay';
import { readStats, recordMatch, type MatchStats } from '../_lib/scores';
import {
  CONTRACTS,
  CONTRACT_INFO,
  DEFAULT_TRIX,
  beginDeal,
  chooseContract,
  createGame,
  finishDeal,
  kingOf,
  legalPlays,
  pass,
  playCard,
  scoreDeal,
  standings,
  type Contract,
  type TrixDeal,
  type TrixGame,
  type TrixOptions,
} from '../_lib/trix';
import { chooseContractFor, choosePlay } from '../_lib/trixAi';
import { DialogClose } from '@/Components/ui/dialog';
import PlayingCard from '@/Domain/games/PlayingCard';
import CardStyleToggle from './CardStyleToggle';
import GameMenu from './GameMenu';
import { useCardDrag } from '../_lib/useCardDrag';
import { useFocusRescue } from '../_lib/useFocusRescue';
import './table.css';

/** Seat 0 is the player; 1 left, 2 opposite, 3 right. */
const HUMAN = 0;
const SEAT_NAMES = ['أنت', 'يسارك', 'شريكك', 'يمينك'];
/** In يهودية there is no partner, so the opposite seat is just "across from you". */
const SOLO_SEAT_NAMES = ['أنت', 'يسارك', 'قبالك', 'يمينك'];
/** Seat labels for a game: فريقين share partners, يهودية has everyone alone. */
const seatNames = (teams: boolean) => (teams ? SEAT_NAMES : SOLO_SEAT_NAMES);
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
const AI_DELAY = 700;

const turnOf = (deal: TrixDeal) => (deal.contract === 'trix' ? deal.turn : deal.round.turn);

/**
 * What changed at the table since the last state, as one sentence for the
 * polite live region: the contract, the other seats' cards and passes, who took
 * each trick, who went out, and the player's turn. The player's own moves are
 * not repeated.
 */
function describeTrix(prev: TrixGame | null, next: TrixGame): string {
  const names = seatNames(next.options.teams);
  const parts: string[] = [];

  if (next.complete) return prev?.complete ? '' : 'انتهت اللعبة';
  if (next.hands && kingOf(next) === HUMAN && !(prev?.hands && kingOf(prev) === HUMAN)) {
    return 'أنت الملك، اختر الطلب';
  }

  const deal = next.deal;
  if (!deal) return '';
  // The contracts of a kingdom are distinct, so kingdom + contract names a deal.
  const same = prev?.deal && prev.kingdom === next.kingdom && prev.deal.contract === deal.contract ? prev.deal : null;
  if (!same) parts.push(`الطلب ${CONTRACT_INFO[deal.contract].name}، الملك ${names[kingOf(next)]}`);

  if (deal.contract === 'trix') {
    const before = same?.contract === 'trix' ? same : null;
    if (before) {
      const mover = before.turn;
      if (mover !== HUMAN) {
        const laid = SUITS.flatMap((suit) =>
          (deal.layout.laid[suit] ?? []).slice((before.layout.laid[suit] ?? []).length).map((power) => ({ suit, power })),
        );
        if (laid.length > 0) {
          for (const { suit, power } of laid) {
            parts.push(`${names[mover]}: ${cardName({ suit, rank: power === 14 ? 1 : power })}`);
          }
        } else if (deal.turn !== before.turn) {
          parts.push(`${names[mover]} باس`);
        }
      }
      for (const seat of deal.out.slice(before.out.length)) {
        parts.push(seat === HUMAN ? 'أنهيتَ أوراقك' : `${names[seat]} أنهى أوراقه`);
      }
    }
  } else {
    const before = same && same.contract !== 'trix' ? same.round : null;
    const plays = (round: typeof deal.round) => [...round.history.flatMap((t) => t.plays), ...round.trick];
    for (const play of plays(deal.round).slice(before ? plays(before).length : 0)) {
      if (play.seat !== HUMAN) parts.push(`${names[play.seat]}: ${cardName(play.card)}`);
    }
    for (const trick of deal.round.history.slice(before?.history.length ?? 0)) {
      parts.push(trick.winner === HUMAN ? 'أخذتَ الأكلة' : `أخذ ${names[trick.winner]} الأكلة`);
    }
  }

  if (deal.phase === 'complete' && same?.phase !== 'complete') parts.push('انتهى الطلب');
  if (deal.phase === 'playing' && turnOf(deal) === HUMAN && (!same || turnOf(same) !== HUMAN)) parts.push('دورك');
  return parts.join('، ');
}

export default function Trix() {
  const [game, setGame] = useState<TrixGame | null>(null);
  const [large, setLarge] = useState(false);
  const [paused, setPaused] = useState(false);
  const [stats, setStats] = useState<MatchStats>({ played: 0, wins: 0, losses: 0, draws: 0 });
  /** The card picked on a touch screen, waiting for a second tap to play it. */
  const [selected, setSelected] = useState<string | null>(null);
  const seen = useRef(0);
  const recorded = useRef(false);
  /** The live region's text, and the game state it was worked out against. */
  const [announcement, setAnnouncement] = useState('');
  const announced = useRef<TrixGame | null>(null);

  const fresh = (opts: TrixOptions) => {
    seen.current = 0;
    recorded.current = false;
    setPaused(false);
    setGame(beginDeal(createGame(opts)));
  };

  useEffect(() => {
    setLarge(readLargeCards());
    setStats(readStats('trix'));
    fresh(DEFAULT_TRIX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record the session once it ends: the player's unit is always index 0.
  useEffect(() => {
    if (!game?.complete || recorded.current) return;
    recorded.current = true;
    setStats(recordMatch('trix', standings(game).winner === 0 ? 'win' : 'loss'));
  }, [game]);

  // One effect drives the table: holds a completed trick, and otherwise lets the
  // next AI seat act after a beat.
  useEffect(() => {
    if (!game || game.complete) return;

    const deal = game.deal;
    if (deal && deal.contract !== 'trix') {
      const done = deal.round.history.length;
      if (deal.phase === 'playing' && done > seen.current) {
        seen.current = done;
        setPaused(true);
        return;
      }
      seen.current = done;
    }
    if (paused) return;

    // The kingdom holder names the next contract.
    if (game.hands) {
      if (kingOf(game) === HUMAN) return;
      const timer = window.setTimeout(() => {
        setGame((g) => (g && g.hands ? chooseContract(g, chooseContractFor(g.hands, kingOf(g), g.remaining)) : g));
      }, AI_DELAY);
      return () => window.clearTimeout(timer);
    }

    const d = game.deal;
    if (!d || d.phase !== 'playing') return;
    const seat = d.contract === 'trix' ? d.turn : d.round.turn;
    if (seat === HUMAN) return;
    const timer = window.setTimeout(() => {
      setGame((g) => {
        if (!g?.deal) return g;
        const current = g.deal;
        const turn = current.contract === 'trix' ? current.turn : current.round.turn;
        const card = choosePlay(current, turn, g.options);
        return { ...g, deal: card ? playCard(current, turn, card) : pass(current, turn) };
      });
    }, AI_DELAY);
    return () => window.clearTimeout(timer);
  }, [game, paused]);

  const hand = useMemo(() => {
    if (!game?.deal) return [];
    const { deal } = game;
    const cards = deal.contract === 'trix' ? deal.hands[HUMAN] : deal.round.hands[HUMAN];
    return cards.toSorted((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || power(a) - power(b));
  }, [game]);

  useEffect(() => {
    setSelected(null);
  }, [game?.deal]);

  useEffect(() => {
    if (!game) return;
    const text = describeTrix(announced.current, game);
    announced.current = game;
    if (text) setAnnouncement(text);
  }, [game]);

  // Hooks run before the loading return below; the drop handler reaches the
  // current render's `play` through a ref.
  const playRef = useRef<(card: Card) => void>(() => {});
  const { drag, ghostRef, startDrag, isTouchPick } = useCardDrag<Card>({
    onDrop: (element, card) => {
      if (element?.closest('.sz-tbl')) playRef.current(card);
    },
  });
  // Every move unmounts the focused control (a played card, the bid buttons);
  // this puts focus back on the table instead of <body>.
  const tableRef = useFocusRescue<HTMLDivElement>(['.sz-tbl__actions', '.sz-tbl__hand']);

  if (!game) {
    return <div className="py-16 text-center text-sm text-muted-foreground">جاري التوزيع…</div>;
  }

  const deal = game.deal;
  const turnSeat = deal ? (deal.contract === 'trix' ? deal.turn : deal.round.turn) : null;
  const humanTurn = deal?.phase === 'playing' && turnSeat === HUMAN && !paused;
  const legal = humanTurn && deal ? legalPlays(deal, HUMAN) : [];
  const legalIds = new Set(legal.map((card) => card.id));
  const canPass = humanTurn && deal?.contract === 'trix' && legal.length === 0;

  // The trick to draw. While paused the one that just finished stays on the
  // table, so its cards are still there when the player taps "كمّل" — as in
  // tarneeb — rather than vanishing before the pause.
  const liveTrick = deal && deal.contract !== 'trix' ? deal.round.trick : [];
  const lastTrick =
    deal && deal.contract !== 'trix' && paused && deal.round.history.length > 0
      ? deal.round.history[deal.round.history.length - 1]
      : null;
  const trickPlays = lastTrick ? lastTrick.plays : liveTrick;
  const trickWinnerSeat = lastTrick ? lastTrick.winner : null;

  const play = (card: Card) => {
    if (!legalIds.has(card.id)) return;
    setSelected(null);
    setGame((g) => (g?.deal ? { ...g, deal: playCard(g.deal, HUMAN, card) } : g));
  };
  playRef.current = play;
  // On a touch screen a tap only picks the card — raised and ringed — and a
  // second tap on it plays. A mouse click plays at once, and a drag plays out.
  const tapCard = (card: Card) => {
    if (!legalIds.has(card.id)) return;
    if (isTouchPick(selected === card.id)) {
      setSelected(card.id);
      return;
    }
    play(card);
  };
  const doPass = () => setGame((g) => (g?.deal ? { ...g, deal: pass(g.deal, HUMAN) } : g));

  const nameContract = (contract: Contract) =>
    setGame((g) => (g && g.hands ? chooseContract(g, contract) : g));
  const proceed = () => setPaused(false);

  const nextDeal = () => {
    setPaused(false);
    seen.current = 0;
    setGame((g) => {
      if (!g?.deal || g.deal.phase !== 'complete') return g;
      const finished = finishDeal(g);
      return finished.complete ? finished : beginDeal(finished);
    });
  };

  const toggleLarge = () =>
    setLarge((value) => {
      writeLargeCards(!value);
      return !value;
    });
  const setMode = (teams: boolean) => {
    if (teams === game.options.teams) return;
    fresh({ teams });
  };

  const { totals } = standings(game);
  const names = seatNames(game.options.teams);
  const units = game.options.teams ? ['فريقك', 'الخصوم'] : names;
  const isKing = game.hands !== null && kingOf(game) === HUMAN;

  return (
    <div ref={tableRef} className="flex h-full select-none flex-col">
      {/* One persistent polite region for everything the other seats do. */}
      <div role="status" className="sr-only">{announcement}</div>
      {/* The two buttons portal into the shell header, beside القوانين. Only the
          running deal stays here. */}
      <GameMenu
        stats={
          <div className="space-y-3">
            <div className="flex items-stretch gap-2 text-center">
              {totals.map((total, i) => (
                <Score key={i} label={units[i] ?? names[i]} value={total} tone={i === 0 ? 'primary' : undefined} />
              ))}
              <Score label="المملكة" value={game.kingdom + 1} />
            </div>
            <p className="text-center text-xs font-bold text-muted-foreground">
              نتائجك: {stats.wins} فوز · {stats.losses} خسارة
            </p>
          </div>
        }
        options={
          <div className="space-y-3">
            <div className="flex items-stretch gap-2">
              <Button
                variant="outline"
                onClick={() => setMode(!game.options.teams)}
                className="flex h-auto flex-col gap-1 rounded-xl px-3 py-2"
                title="تبديل بين يهودية وفريقين"
              >
                <span className="text-[13px]" aria-hidden="true">⇄</span>
                <span className="text-[11px] font-bold">{game.options.teams ? 'فريقين' : 'يهودية'}</span>
              </Button>
              <CardStyleToggle large={large} onToggle={toggleLarge} />
              <DialogClose asChild>
                <Button variant="outline" onClick={() => fresh(game.options)} className="flex h-auto flex-1 flex-col gap-1 rounded-xl px-3 py-2">
                  <RefreshCw className="h-4 w-4" />
                  <span className="text-[11px] font-bold">جديد</span>
                </Button>
              </DialogClose>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              «⇄» يبدّل بين اليهودية والفريقين، و«أرقام» يبدّل شكل الورق. «جديد» يبدأ جلسة جديدة.
            </p>
          </div>
        }
      />

      <p className="mb-2 min-h-[1.25rem] shrink-0 text-center text-xs font-bold text-muted-foreground">
        {deal ? `${CONTRACT_INFO[deal.contract].name} · الملك ${names[kingOf(game)]}` : ' '}
      </p>

      <div className="sz-tbl" dir="ltr">
        <Seat name={names[2]} count={handCount(game, 2)} className="sz-tbl__seat--north" />
        <Seat name={names[1]} count={handCount(game, 1)} className="sz-tbl__seat--west" />
        <Seat name={names[3]} count={handCount(game, 3)} className="sz-tbl__seat--east" />

        <div className="sz-tbl__centre">
          <div className="sz-tbl__trick" role="group" aria-label="الطاولة">
            {deal?.contract === 'trix' ? (
              <Layout deal={deal} large={large} />
            ) : deal ? (
              <>
                <Slot position="n" seatName={names[2]} card={cardAtSeat(trickPlays, 2)} win={trickWinnerSeat === 2} large={large} />
                <Slot position="w" seatName={names[1]} card={cardAtSeat(trickPlays, 1)} win={trickWinnerSeat === 1} large={large} />
                <div className="sz-tbl__slot sz-tbl__slot--c" />
                <Slot position="e" seatName={names[3]} card={cardAtSeat(trickPlays, 3)} win={trickWinnerSeat === 3} large={large} />
                <Slot position="s" seatName={names[HUMAN]} card={cardAtSeat(trickPlays, HUMAN)} win={trickWinnerSeat === HUMAN} large={large} />
              </>
            ) : null}
          </div>
        </div>

        <div className="sz-tbl__hand" data-focus-group="hand">
          {hand.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              large={large}
              interactive={legalIds.has(card.id)}
              picked={selected === card.id}
              className={legalIds.has(card.id) ? 'sz-tbl__playable' : ''}
              onPointerDown={(e) => { if (legalIds.has(card.id)) startDrag(e, card); }}
              onClick={() => tapCard(card)}
            />
          ))}
        </div>
      </div>

      {/* The card following the finger while it is dragged out to play. */}
      {drag && (
        <div
          ref={ghostRef}
          className="sz-tbl__ghost"
          style={
            {
              left: drag.x,
              top: drag.y,
              width: drag.w,
              '--sz-card-w': `${drag.w}px`,
              '--sz-card-h-ratio': 1.4286,
            } as React.CSSProperties
          }
        >
          <PlayingCard card={drag.payload} large={large} decorative />
        </div>
      )}

      <div className="sz-tbl__actions mt-2 shrink-0" data-focus-group="actions">
        {game.complete ? (
          <GameOver game={game} onNew={() => fresh(game.options)} />
        ) : isKing ? (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm font-bold">اختر الطلب:</span>
            {CONTRACTS.map((contract) => (
              <button
                key={contract}
                type="button"
                disabled={!game.remaining.includes(contract)}
                onClick={() => nameContract(contract)}
                className="sz-tbl__bid disabled:opacity-30"
              >
                {CONTRACT_INFO[contract].name}
              </button>
            ))}
          </div>
        ) : paused ? (
          <Button onClick={proceed}>كمّل</Button>
        ) : deal?.phase === 'complete' ? (
          <DealResult game={game} onNext={nextDeal} />
        ) : deal ? (
          <span className="flex items-center gap-3 text-sm text-muted-foreground">
            {humanTurn ? (canPass ? 'لا ورقة تنزل — باس' : 'دورك — نزّل ورقة') : `دور ${names[turnSeat ?? 0]}…`}
            {canPass && <Button size="sm" variant="outline" onClick={doPass}>باس</Button>}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">الملك {names[kingOf(game)]} يوزّع…</span>
        )}
      </div>
    </div>
  );
}

export function TrixRules() {
  return (
    <>
      <p>تركس لعبة أربعة لاعبين بلا حكم، تُلعب عشرين مصفًا: أربع ممالك، لكل لاعب مملكة يختار فيها الطلبات الخمسة.</p>
      <ul className="list-disc space-y-1 ps-5">
        {CONTRACTS.map((contract) => (
          <li key={contract}>{CONTRACT_INFO[contract].name}</li>
        ))}
      </ul>
      <ul className="list-disc space-y-1 ps-5">
        <li>البنات: كل بنت −25. الديناري: كل دينارية −10. اللطوش: كل لطش −15. شيخ الكبة: من يأخذه −75.</li>
        <li>التركس: ابدأ من الشاب، ومن أنهى أوراقه أولًا +200 ثم +150 ثم +100 ثم +50.</li>
        <li>يجب اتباع اللون، ولا يوجد حكم؛ وفي شيخ الكبة لا تبدأ بالكبة إلا إن كانت كل أوراقك كبة.</li>
        <li>يهودية: كل لاعب لنفسه. فريقين: المتقابلان شريكان وتُجمع نقاطهما.</li>
      </ul>
    </>
  );
}

function handCount(game: TrixGame, seat: number): number {
  const deal = game.deal;
  if (!deal) return game.hands ? game.hands[seat].length : 0;
  return deal.contract === 'trix' ? deal.hands[seat].length : deal.round.hands[seat].length;
}

function cardAtSeat(plays: Play[], seat: number): Card | undefined {
  return plays.find((play) => play.seat === seat)?.card;
}

function cardOf(suit: Suit, power: number): Card {
  return { id: `${suit}${power}`, rank: power === 14 ? 1 : power, suit, faceUp: true };
}

function Layout({ deal, large }: { deal: Extract<TrixDeal, { contract: 'trix' }>; large: boolean }) {
  return (
    <div className="sz-tbl__layout">
      {SUITS.map((suit) => {
        const laid = new Set(deal.layout.laid[suit] ?? []);
        const ranks = Array.from({ length: 13 }, (_, i) => i + 2)
          .filter((power) => laid.has(power))
          .map((power) => RANK_LABEL[power === 14 ? 1 : power]);
        return (
          <div key={suit} className="sz-tbl__run">
            {/* The column is a picture of the run; this is its text. */}
            <span className="sr-only">
              {`${SUIT_NAME_AR[suit]}: ${ranks.length > 0 ? ranks.join(' ') : 'لا شيء بعد'}`}
            </span>
            {laid.size === 0 && <span className="sz-tbl__run-suit" aria-hidden="true">{SUIT_LABEL[suit]}</span>}
            {/* Slots run Ace (top) to 2 (bottom), so the Jack lands mid-column:
                Q/K/A above it, 10 down to 2 below — the rank order, not the
                order they were played, and the height is already reserved. */}
            {Array.from({ length: 13 }, (_, i) => 14 - i)
              .filter((power) => laid.has(power))
              .map((power) => (
                <div
                  key={power}
                  className="sz-tbl__run-slot"
                  style={{ top: `calc(${14 - power} * var(--sz-tbl-run-step))` }}
                >
                  <PlayingCard card={cardOf(suit, power)} large={large} decorative />
                </div>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function DealResult({ game, onNext }: { game: TrixGame; onNext: () => void }) {
  const deal = game.deal!;
  const points = scoreDeal(deal);
  const names = seatNames(game.options.teams);
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card/60 p-4 text-center">
      <p className="text-sm font-bold">
        {CONTRACT_INFO[deal.contract].name} · {points.map((p, seat) => `${names[seat]} ${p}`).join(' · ')}
      </p>
      <Button onClick={onNext} className="mt-3">
        الطلب الجاي
      </Button>
    </div>
  );
}

function GameOver({ game, onNew }: { game: TrixGame; onNew: () => void }) {
  const { totals, winner } = standings(game);
  const units = game.options.teams ? ['فريقك', 'الخصوم'] : seatNames(game.options.teams);
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
      <p className="text-lg font-black text-primary">
        انتهت اللعبة — {winner === null ? 'تعادل' : `الفائز ${units[winner]}`}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {units.map((name, i) => `${name} ${totals[i]}`).join(' · ')}
      </p>
      <Button onClick={onNew} className="mt-3">
        لعبة جديدة
      </Button>
    </div>
  );
}

function Score({ label, value, tone }: { label: string; value: number; tone?: 'primary' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-card/60 px-2 py-2">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <span dir="ltr" className={`font-mono text-base font-black tabular-nums ${tone === 'primary' ? 'text-primary' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function Seat({ name, count, className = '' }: { name: string; count: number; className?: string }) {
  return (
    <div className={`sz-tbl__seat ${className}`}>
      <span className="sz-tbl__seat-name">{name}</span>
      <div className="sz-tbl__seat-hand sz-tbl__seat-hand--h">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="sz-card sz-card--back" aria-hidden="true" />
        ))}
      </div>
      <span className="sz-tbl__seat-bid" />
    </div>
  );
}

function Slot({
  position,
  seatName,
  card,
  win,
  large,
}: {
  position: string;
  seatName: string;
  card?: Card;
  win: boolean;
  large: boolean;
}) {
  return (
    <div className={`sz-tbl__slot sz-tbl__slot--${position} ${win ? 'sz-tbl__slot--win' : ''}`}>
      {card && <PlayingCard card={card} decorative large={large} />}
      {/* The drawn card is decorative; this is what a screen reader hears. */}
      {card && <span className="sr-only">{`${seatName}: ${cardName(card)}${win ? '، الأعلى' : ''}`}</span>}
    </div>
  );
}
