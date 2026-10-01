import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Lightbulb, RefreshCw, Undo2 } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { SUIT_LABEL, type Card, type Suit } from '../_lib/cards';
import {
  autoMove,
  availableMoves,
  applyMove,
  canDraw,
  canMove,
  createDeal,
  describeMove,
  drawStock,
  isWon,
  liftable,
  type Deal,
  type Destination,
  type Source,
} from '../_lib/solitaire';
import { readRecord, recordResult } from '../_lib/scores';
import { readLargeCards, writeLargeCards } from '../_lib/cardDisplay';
import PlayingCard from './PlayingCard';
import HeaderButton from './HeaderButton';
import HeaderPortal from './HeaderPortal';

type Selection = { from: Source; ids: string[] };

/** Foundation slots show their suit even when empty, in this order. */
const FOUNDATION_SUITS: Suit[] = ['S', 'H', 'D', 'C'];

/** Switch-based so TypeScript narrows both operands, which `&&` chains do not. */
const sameSource = (a: Source, b: Source): boolean => {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'waste':
      return true;
    case 'foundation':
      return b.kind === 'foundation' && a.index === b.index;
    case 'tableau':
      return b.kind === 'tableau' && a.column === b.column && a.cardIndex === b.cardIndex;
  }
};

const clock = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const EMPTY: Deal = {
  stock: [],
  waste: [],
  foundations: [[], [], [], []],
  tableau: [[], [], [], [], [], [], []],
};

/**
 * Klondike. The rules live in `_lib/solitaire`; this file owns the clock, the
 * selection, the undo stack and the two ways of moving a card — drag on a
 * pointer, tap-then-tap everywhere else, since native HTML5 drag never fires
 * on touch. Every `Deal` is treated as immutable: each move returns a new one,
 * which is what makes the undo stack a plain array.
 */
export default function Solitaire() {
  // Seeded in an effect: the server has no shuffle to match, and a random deal
  // rendered during SSR could never hydrate.
  const [deal, setDeal] = useState<Deal>(EMPTY);
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<Deal[]>([]);
  const [moves, setMoves] = useState(0);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [hint, setHint] = useState<Source | null>(null);
  const [dragFrom, setDragFrom] = useState<Source | null>(null);
  const [over, setOver] = useState<string | null>(null);
  /** The run the pointer is carrying, with its current viewport position. */
  const [ghost, setGhost] = useState<{ run: Card[]; x: number; y: number; w: number } | null>(null);
  const [best, setBest] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [newBest, setNewBest] = useState(false);
  /** Draw every card as one big rank instead of pips (shared with the games). */
  const [large, setLarge] = useState(false);

  // The board as handlers read it, so two moves in the same tick cannot race
  // on a stale copy from the render closure.
  const board = useRef(deal);
  board.current = deal;

  const newGame = useCallback(() => {
    const fresh = createDeal();
    board.current = fresh;
    setDeal(fresh);
    setHistory([]);
    setMoves(0);
    setSelected(null);
    setHint(null);
    setElapsed(0);
    setWon(false);
    setNewBest(false);
  }, []);

  const toggleLarge = () =>
    setLarge((value) => {
      writeLargeCards(!value);
      return !value;
    });

  useEffect(() => {
    const fresh = createDeal();
    board.current = fresh;
    setDeal(fresh);
    setReady(true);
    setBest(readRecord('solitare'));
    setLarge(readLargeCards());
  }, []);

  // The clock stops when the game is finished.
  useEffect(() => {
    if (!ready || won) return;
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [ready, won]);

  // Record the time once, at the moment the game is won.
  useEffect(() => {
    if (!won) return;
    const result = recordResult('solitare', elapsed, 'lower');
    setBest(result.record);
    setNewBest(result.improved);
  }, [won, elapsed]);

  const commit = useCallback((next: Deal) => {
    setHistory((h) => [...h.slice(-99), board.current]);
    board.current = next;
    setDeal(next);
    setSelected(null);
    setHint(null);
  }, []);

  const tryMove = useCallback(
    (from: Source, to: Destination) => {
      const current = board.current;
      if (!canMove(current, from, to)) return false;
      const next = applyMove(current, from, to);
      if (next === current) return false;
      setMoves((m) => m + 1);
      commit(next);
      if (isWon(next)) setWon(true);
      return true;
    },
    [commit],
  );

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const previous = h[h.length - 1];
      board.current = previous;
      setDeal(previous);
      setMoves((m) => Math.max(0, m - 1));
      setSelected(null);
      setHint(null);
      setWon(false);
      setNewBest(false);
      return h.slice(0, -1);
    });
  }, []);

  const turnStock = useCallback(() => {
    if (!canDraw(board.current)) return;
    setMoves((m) => m + 1);
    commit(drawStock(board.current));
  }, [commit]);

  /** Double-click, or tapping a selected card again: send it to a foundation. */
  const sendToFoundation = useCallback(
    (from: Source) => {
      for (let index = 0; index < 4; index++) {
        if (tryMove(from, { kind: 'foundation', index })) return true;
      }
      return false;
    },
    [tryMove],
  );

  /** Tap a card to select it (with the run it would lift); tap again to drop the selection. */
  const toggle = useCallback((from: Source) => {
    const run = liftable(board.current, from);
    if (!run) return;
    if (selected && sameSource(selected.from, from)) {
      setSelected(null);
      return;
    }
    setSelected({ from, ids: run.map((c) => c.id) });
  }, [selected]);

  /** With something selected, a pile becomes a destination; otherwise it is itself a source. */
  const onFoundation = useCallback(
    (index: number) => {
      if (selected) tryMove(selected.from, { kind: 'foundation', index });
      else toggle({ kind: 'foundation', index });
    },
    [selected, toggle, tryMove],
  );

  const onTableauColumn = useCallback(
    (column: number) => {
      if (selected) tryMove(selected.from, { kind: 'tableau', column });
    },
    [selected, tryMove],
  );

  /**
   * Tapping a face-up tableau card. With something selected elsewhere it is the
   * drop target (so tap-tap can place onto an occupied column, not just an
   * empty one); otherwise, or when the move is illegal, it becomes the new
   * selection.
   */
  const onTableauCard = useCallback(
    (column: number, from: Source) => {
      if (selected && !sameSource(selected.from, from)) {
        if (tryMove(selected.from, { kind: 'tableau', column })) return;
      }
      toggle(from);
    },
    [selected, tryMove, toggle],
  );

  // The in-flight pointer drag, kept in a ref so the window listeners always
  // read the latest and never go stale. A drag only becomes "active" once the
  // pointer has moved past a small threshold, which is what lets a plain tap
  // still select a card.
  const dragRef = useRef<{
    from: Source;
    run: Card[];
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    width: number;
    active: boolean;
  } | null>(null);

  /** Resolve a drop key (`stock` | `waste` | `f3` | `t2`) to a move. */
  const applyDrop = useCallback(
    (key: string, from: Source) => {
      if (key === 'stock') turnStock();
      else if (key.startsWith('f')) tryMove(from, { kind: 'foundation', index: Number(key.slice(1)) });
      else if (key.startsWith('t')) tryMove(from, { kind: 'tableau', column: Number(key.slice(1)) });
      // 'waste' accepts nothing — Klondike never moves a card back into it.
    },
    [tryMove, turnStock],
  );

  /**
   * Pointer-based drag, used for mouse, touch and pen alike (native HTML5 drag
   * never fires on touch). A move only starts after an 8px threshold so a tap
   * still falls through to the click-to-select handler; a drag swallows the
   * click the browser fires on release so it does not also toggle a selection.
   */
  const startDrag = useCallback(
    (from: Source, e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const run = liftable(board.current, from);
      if (!run || run.length === 0) return;

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      dragRef.current = {
        from,
        run,
        startX: e.clientX,
        startY: e.clientY,
        grabX: e.clientX - rect.left,
        grabY: e.clientY - rect.top,
        width: rect.width,
        active: false,
      };

      const move = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d) return;
        if (!d.active) {
          if (Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) < 8) return;
          d.active = true;
          setDragFrom(d.from);
        }
        if (ev.cancelable) ev.preventDefault();
        setGhost({ run: d.run, x: ev.clientX - d.grabX, y: ev.clientY - d.grabY, w: d.width });
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const pile = under instanceof Element ? under.closest('[data-drop]') : null;
        setOver(pile ? pile.getAttribute('data-drop') : null);
      };

      const finish = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
        window.removeEventListener('pointercancel', finish);
        const d = dragRef.current;
        dragRef.current = null;
        setGhost(null);
        setDragFrom(null);
        setOver(null);
        if (!d?.active) return;
        // Swallow the synthetic click that follows the release.
        const swallow = (ce: Event) => {
          ce.stopPropagation();
          ce.preventDefault();
          window.removeEventListener('click', swallow, true);
        };
        window.addEventListener('click', swallow, true);
        window.setTimeout(() => window.removeEventListener('click', swallow, true), 500);
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const pile = under instanceof Element ? under.closest('[data-drop]') : null;
        const key = pile ? pile.getAttribute('data-drop') : null;
        if (key) applyDrop(key, d.from);
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    },
    [applyDrop],
  );

  const showHint = useCallback(() => {
    const candidates = availableMoves(board.current);
    if (candidates.length === 0) {
      setHint(null);
      return;
    }
    // Anything that reaches a foundation is the useful thing to point at.
    const pick = candidates.find((m) => m.to.kind === 'foundation') ?? candidates[0];
    setHint(pick.from);
    setSelected({ from: pick.from, ids: liftable(board.current, pick.from)!.map((c) => c.id) });
  }, []);

  const finish = useCallback(() => {
    const current = board.current;
    const next = autoMove(current);
    if (next === current) return;
    const sent = next.foundations.reduce((n, p) => n + p.length, 0) - current.foundations.reduce((n, p) => n + p.length, 0);
    setMoves((m) => m + sent);
    commit(next);
    if (isWon(next)) setWon(true);
  }, [commit]);

  const hintText = useMemo(() => {
    if (!hint) return null;
    const move = availableMoves(board.current).find((m) => sameSource(m.from, hint));
    return move ? describeMove(board.current, move) : null;
    // `deal` is the signal that the board changed, which invalidates a hint.
  }, [hint, deal]);

  const stuck = ready && !won && !canDraw(deal) && availableMoves(deal).length === 0;
  const canFinish = availableMoves(deal).some((m) => m.to.kind === 'foundation');

  if (!ready) {
    return <div className="py-16 text-center text-sm text-muted-foreground">جاري التوزيع…</div>;
  }

  /**
   * Drop-target plumbing shared by every pile. The key doubles as the
   * `data-drop` value the pointer drag hit-tests against, and drives the hover
   * tint while the pointer is over this pile.
   */
  const dropProps = (key: string) => ({
    dropKey: key,
    isOver: over === key,
  });

  return (
    <div className="select-none">
      {/* The action buttons portal into the shell header, beside القوانين; the
          glanceable readouts stay here. */}
      <HeaderPortal>
        <HeaderButton icon={Undo2} onClick={undo} disabled={history.length === 0} title="تراجع">
          تراجع
        </HeaderButton>
        <HeaderButton icon={Lightbulb} onClick={showHint} title="تلميح">
          تلميح
        </HeaderButton>
        <HeaderButton icon={Hash} active={large} onClick={toggleLarge} title="إظهار الأرقام أو الأنماط">
          أرقام
        </HeaderButton>
        <HeaderButton icon={RefreshCw} onClick={newGame} title="لعبة جديدة">
          جديد
        </HeaderButton>
      </HeaderPortal>

      <div className="mb-4 flex items-stretch gap-2">
        <Stat label="الوقت" value={clock(elapsed)} />
        <Stat label="الحركات" value={moves} />
        <Stat label="أفضل وقت" value={best ? clock(best) : '—'} tone="primary" />
      </div>

      {hintText && (
        <p className="mb-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-bold text-primary">
          {hintText}
        </p>
      )}
      {stuck && (
        <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-bold text-destructive">
          لا توجد حركات ممكنة. ابدأ لعبة جديدة.
        </p>
      )}

      {/* A deal is read left to right, so the board is LTR even though the page is RTL. */}
      <div dir="ltr" className="sz-sol">
        {/* Stock, waste, then the four foundations, each in one of the same
            seven tracks the tableau uses, so the foundations sit directly above
            the columns they will be fed from. */}
        <div className="sz-sol-row mb-3">
          <Pile {...dropProps('stock')} className="sz-sol-slot" label="المخزون">
            <button
              type="button"
              onClick={turnStock}
              disabled={!canDraw(deal)}
              aria-label="اسحب من المخزون"
              className="sz-sol-blank sz-sol-blank--hit"
            >
              {deal.stock.length > 0 ? (
                <span className="sz-card sz-card--back">
                  <span className="sz-card__count">{deal.stock.length}</span>
                </span>
              ) : (
                <span className="sz-sol-glyph">{deal.waste.length > 0 ? '\u21bb' : ''}</span>
              )}
            </button>
          </Pile>

          {/* Waste. A source only — Klondike has no move back into it. */}
          <Pile {...dropProps('waste')} className="sz-sol-slot" label="البطاقات المسحوبة">
            {deal.waste.length === 0 ? (
              <div className="sz-sol-blank" />
            ) : (
              <div className="sz-sol-waste">
                {deal.waste.slice(-3).map((card, i, shown) => (
                  <PlayingCard
                    key={card.id}
                    card={card}
                    large={large}
                    // Draw-one: only the top card of the waste can move, so the
                    // ones peeking out from under it are decoration, not targets.
                    interactive={i === shown.length - 1}
                    picked={selected?.from.kind === 'waste'}
                    hinted={hint?.kind === 'waste'}
                    onClick={() => toggle({ kind: 'waste' })}
                    onDoubleClick={() => sendToFoundation({ kind: 'waste' })}
                    onPointerDown={(e) => startDrag({ kind: 'waste' }, e)}
                  />
                ))}
              </div>
            )}
          </Pile>

          {/* The gap that separates the stock and waste from the foundations, so
              the four collected-card groups line up over the rightmost columns
              the way a real deal is read. */}
          <div aria-hidden="true" />

          {deal.foundations.map((pile, index) => (
            <Pile
              key={`f${index}`}
              {...dropProps(`f${index}`)}
              className="sz-sol-slot"
              label={`الأساس ${index + 1}`}
              onPileClick={() => onFoundation(index)}
            >
              {pile.length === 0 ? (
                <div className="sz-sol-blank">
                  <span className="sz-sol-glyph">{SUIT_LABEL[FOUNDATION_SUITS[index]]}</span>
                </div>
              ) : (
                <PlayingCard
                  card={pile[pile.length - 1]}
                  large={large}
                  interactive
                  picked={selected?.from.kind === 'foundation' && selected.from.index === index}
                  hinted={hint?.kind === 'foundation' && hint.index === index}
                  onClick={() => onFoundation(index)}
                  onDoubleClick={() => sendToFoundation({ kind: 'foundation', index })}
                  onPointerDown={(e) => startDrag({ kind: 'foundation', index }, e)}
                />
              )}
            </Pile>
          ))}
        </div>

        {/* Seven tableau columns, each a hidden stack cascading into a face-up
            run, with a dock below it. The run is pulled up over the last hidden
            card (`sz-sol-fan--tucked`) so a column reads as one cascade. */}
        <div className="sz-sol-row">
          {deal.tableau.map((column, colIndex) => {
            const isLegalHere =
              over === `t${colIndex}` &&
              dragFrom !== null &&
              canMove(board.current, dragFrom, { kind: 'tableau', column: colIndex });
            const firstUp = column.findIndex((card) => card.faceUp);
            const hidden = firstUp === -1 ? column : column.slice(0, firstUp);
            const up = firstUp === -1 ? [] : column.slice(firstUp);

            return (
              <Pile
                key={`t${colIndex}`}
                {...dropProps(`t${colIndex}`)}
                className="sz-sol-pile--tableau"
                label={`العمود ${colIndex + 1}`}
                onPileClick={() => onTableauColumn(colIndex)}
              >
                <div className="sz-sol-stack">
                  {hidden.map((card) => (
                    <div key={card.id} className="sz-card sz-card--back" aria-hidden="true" />
                  ))}
                </div>

                {up.length === 0 ? (
                  column.length === 0 && (
                    <div
                      className={`sz-sol-blank sz-sol-blank--fan ${
                        isLegalHere ? 'sz-sol-blank--drop' : ''
                      }`}
                    />
                  )
                ) : (
                  <div className={`sz-sol-fan ${hidden.length > 0 ? 'sz-sol-fan--tucked' : ''}`}>
                    {up.map((card, i) => {
                      const from: Source = {
                        kind: 'tableau',
                        column: colIndex,
                        cardIndex: firstUp + i,
                      };
                      const movable = liftable(board.current, from) !== null;
                      const hinted =
                        hint?.kind === 'tableau' && hint.column === colIndex
                          ? (liftable(board.current, hint)?.some((c) => c.id === card.id) ?? false)
                          : false;
                      // A dragged card lands on the column's last face-up card,
                      // so that is the one to light up — highlighting the whole
                      // pile reads as if the hidden cards were the target.
                      const receivesDrop = isLegalHere && i === up.length - 1;
                      return (
                        <PlayingCard
                          key={card.id}
                          card={card}
                          large={large}
                          dropTarget={receivesDrop}
                          interactive={movable}
                          picked={selected?.ids.includes(card.id) ?? false}
                          hinted={hinted}
                          onClick={() => movable && onTableauCard(colIndex, from)}
                          onDoubleClick={() => movable && sendToFoundation(from)}
                          onPointerDown={(e) => movable && startDrag(from, e)}
                        />
                      );
                    })}
                  </div>
                )}

                <div
                  className={`sz-sol-dock ${up.length === 0 ? 'sz-sol-dock--plain' : ''}`}
                  aria-hidden="true"
                />
              </Pile>
            );
          })}
        </div>
      </div>

      {/* The run under the pointer, following it until release. It lives outside
          the board so `position: fixed` stays viewport-relative (the board's
          `container-type` would otherwise become its containing block), and it
          carries the board's card length inline so the corner text is sized. */}
      {ghost && (
        <div
          className="sz-sol-ghost"
          style={
            {
              left: ghost.x,
              top: ghost.y,
              width: ghost.w,
              '--sz-card-w': `${ghost.w}px`,
              '--sz-card-h-ratio': 1.4286,
              '--sz-sol-face-step': `${ghost.w * 1.4286 * 0.29}px`,
            } as React.CSSProperties
          }
        >
          {ghost.run.map((card) => (
            <PlayingCard key={card.id} card={card} large={large} decorative />
          ))}
        </div>
      )}

      {won ? (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-center">
          <p className="text-lg font-black text-primary">أكملت اللعبة!</p>
          <p className="mt-1 text-sm text-muted-foreground">
            الوقت {clock(elapsed)} · {moves} حركة
            {newBest ? ' · أفضل وقت جديد!' : best ? ` · أفضل وقت ${clock(best)}` : ''}
          </p>
          <Button onClick={newGame} className="mt-3">لعبة جديدة</Button>
        </div>
      ) : (
        canFinish && (
          <div className="mt-3 text-center">
            <Button variant="ghost" size="sm" onClick={finish} className="text-xs text-muted-foreground">
              اصعد ما يمكن صعوده
            </Button>
          </div>
        )
      )}
    </div>
  );
}

interface PileProps {
  dropKey: string;
  label: string;
  className?: string;
  children?: React.ReactNode;
  isOver: boolean;
  onPileClick?: () => void;
}

/** A slot a card can land on. Pointer drags hit-test its `data-drop` key. */
function Pile({ dropKey, label, className = '', children, isOver, onPileClick }: PileProps) {
  return (
    <div
      data-drop={dropKey}
      // Only a neutral hover tint here. A legal drop is shown on the card that
      // would receive it, so tinting the whole pile would paint over the hidden
      // cards and read as if they were the target.
      className={`sz-sol-pile ${isOver ? 'sz-sol-pile--over' : ''} ${className}`}
      onClick={onPileClick}
    >
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'primary' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-card/60 px-2 py-2">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <span
        dir="ltr"
        className={`font-mono text-base font-black tabular-nums ${
          tone === 'primary' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function SolitaireRules() {
  return (
    <>
      <ul className="list-disc space-y-1 ps-5">
        <li>الهدف: رتّب الأوراق على الأساسات الأربعة من الآس حتى الملك، كل لون على حدة.</li>
        <li>
          يُوزَّع السبعة أعمدة بأوراق متتالية ١ إلى ٧، وآخر ورقة في كل عمود مكشوفة والباقي مقلوب.
        </li>
        <li>اضغط المخزون لسحب ورقة واحدة إلى البساط، وعند نفاد المخزون يُعاد البساط إليه.</li>
        <li>في الأعمدة تُبنى الأوراق تنازليًا ١٣ إلى ١ بالألوان المتناوبة، والملك وحده يبدأ عمودًا فارغًا.</li>
        <li>يمكنك تحريك سلسلة كاملة مرتّبة مكشوفة، وتُقلب الورقة المقلوبة التي تنكشف تحتها.</li>
        <li>في الأساسات تُبنى الأوراق تصاعديًا ١ إلى ١٣ في اللون نفسه.</li>
        <li>تفوز عندما تكتمل الأساسات الأربعة، وأفضل وقتك يُحفظ على جهازك.</li>
        <li>التحكّم: انقر ورقة لتحديدها ثم انقر الوجهة، أو اسحبها؛ وعلى الجوال المس أو اسحب.</li>
      </ul>
    </>
  );
}
