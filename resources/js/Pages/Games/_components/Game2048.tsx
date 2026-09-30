import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import {
  SIZE,
  TARGET,
  canMove,
  emptyBoard,
  highestTile,
  move,
  newBoard,
  spawn,
  tileClass,
  tileFontClass,
  type AbsorbedTile,
  type Direction,
  type Tile,
} from '../_lib/engine2048';
import { readRecord, recordResult } from '../_lib/scores';

type Phase = 'playing' | 'won' | 'lost';

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
};

/** Pointer travel (px) that counts as a swipe rather than a stray tap. */
const SWIPE_THRESHOLD = 24;

/**
 * How long an eaten tile lingers: the slide, then its fade-out, plus a little
 * slack so the fade finishes before React unmounts it. Kept in step with
 * --sz-2048-slide / --sz-2048-die in app.css.
 */
const GHOST_MS = 320;

export default function Game2048() {
  // Tile ids only need to be unique per session; a ref keeps the counter out of
  // the render path so the move callback stays stable.
  const nextId = useRef(1);
  const id = useCallback(() => nextId.current++, []);

  // Seeded in an effect rather than in useState: SSR renders an empty grid and
  // the client fills it on mount, so hydration stays deterministic (a random
  // board on the server would never match the client's).
  const [board, setBoard] = useState<Tile[]>(emptyBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
  // Latched once the player dismisses the win overlay, so the next move cannot
  // re-raise it just because the 2048 tile is still sitting on the board.
  const [keepPlaying, setKeepPlaying] = useState(false);
  // Tiles eaten by a merge, kept around for one slide so the eye can follow
  // the tile into its killer instead of seeing it blink out of existence.
  const [ghosts, setGhosts] = useState<AbsorbedTile[]>([]);
  const ghostTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (ghostTimer.current) clearTimeout(ghostTimer.current);
    },
    [],
  );

  const start = useCallback(() => {
    setBoard(newBoard(id));
    setScore(0);
    setPhase('playing');
    setKeepPlaying(false);
    setGhosts([]);
  }, [id]);

  useEffect(() => {
    setBoard(newBoard(id));
    setBest(readRecord('2048'));
  }, [id]);

  // Record a new best as soon as it is beaten, so closing the tab mid-run does
  // not lose the score.
  useEffect(() => {
    if (score > 0) setBest(recordResult('2048', score, 'higher').record);
  }, [score]);

  // Every transition is derived from the current board in one pass rather than
  // from a setState updater: updaters must stay pure, and a second one would
  // have to replay the move to know whether it moved anything.
  const play = useCallback(
    (dir: Direction) => {
      if (board.length === 0) return;
      if (phase === 'lost') return;
      if (phase === 'won' && !keepPlaying) return;

      const result = move(board, dir);
      if (!result.moved) return;

      const next = spawn(result.tiles, id);
      setBoard(next);

      if (result.absorbed.length > 0) {
        // Accumulate rather than replace: a move that lands while an earlier
        // ghost is still sliding must not yank it off the board.
        setGhosts((prev) => [...prev, ...result.absorbed]);
        if (ghostTimer.current) clearTimeout(ghostTimer.current);
        ghostTimer.current = setTimeout(() => setGhosts([]), GHOST_MS);
      }

      setScore((s) => s + result.gained);
      if (!keepPlaying && highestTile(next) >= TARGET) {
        setPhase('won');
        return;
      }
      setPhase(canMove(next) ? 'playing' : 'lost');
    },
    [board, id, keepPlaying, phase],
  );

  // Keyboard: arrows plus WASD. preventDefault keeps the page from scrolling
  // mid-game, which is the behaviour players expect from a board that owns the
  // arrow keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const dir = KEY_DIRECTIONS[e.key];
      if (!dir) return;
      e.preventDefault();
      play(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play]);

  // Swipe. RTL mirrors text, not pointer coordinates, so this is direction-
  // identical in both layouts.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const origin = touch.current;
    touch.current = null;
    if (!origin) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - origin.x;
    const dy = t.clientY - origin.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  };

  return (
    <div className="mx-auto w-full max-w-md select-none">
      <div className="mb-4 flex items-stretch gap-2">
        <Stat label="النقاط" value={score} tone="primary" />
        <Stat label="أفضل نتيجة" value={best} />
        <Button
          variant="outline"
          onClick={start}
          className="flex h-auto shrink-0 flex-col gap-1 rounded-xl px-4 py-2"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-[11px] font-bold">لعبة جديدة</span>
        </Button>
      </div>

      <div
        dir="ltr"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          touch.current = null;
        }}
        className="relative aspect-square w-full touch-none rounded-2xl bg-[#bbada0] p-2 shadow-inner dark:bg-[#4c4a41]"
      >
        {/* Empty cells. Static, so they use the same grid helper but never move. */}
        {Array.from({ length: SIZE * SIZE }, (_, i) => (
          <div
            key={`cell-${i}`}
            className="sz-2048-cell rounded-xl bg-[#cdc1b4] dark:bg-[#5a564b]"
            style={{ transform: at(i % SIZE, Math.floor(i / SIZE)) }}
          />
        ))}

        {/* Tiles a merge ate, still sliding into their killer. Keyed by the
            eaten tile's id so a fast second move does not restart the fade. */}
        {ghosts.map((g) => (
          <div
            key={`ghost-${g.id}`}
            className="sz-2048-cell sz-2048-ghost"
            style={
              {
                '--sz-2048-fx': g.col,
                '--sz-2048-fy': g.row,
                '--sz-2048-tx': g.targetCol,
                '--sz-2048-ty': g.targetRow,
              } as React.CSSProperties
            }
          >
            <div
              className={`sz-2048-face sz-2048-face-die ${tileClass(g.value)}`}
              style={{ fontSize: tileFontClass(g.value) }}
            >
              {g.value}
            </div>
          </div>
        ))}

        {/* Keyed by tile id: a slide is a transform change on the same DOM node,
            which is exactly what .sz-2048-tile transitions. The face is keyed
            on the merge count instead, so a tile that merges twice in a row
            remounts its face and the pop replays. */}
        {board.map((t) => (
          <div key={t.id} className="sz-2048-cell sz-2048-tile" style={{ transform: at(t.col, t.row) }}>
            <div
              key={`${t.id}-${t.merges}`}
              className={`sz-2048-face ${tileClass(t.value)} ${
                t.fresh
                  ? 'sz-2048-face-appear'
                  : t.merged
                    ? t.moved
                      ? 'sz-2048-face-pop'
                      : 'sz-2048-face-pop-now'
                    : ''
              }`}
              style={{ fontSize: tileFontClass(t.value) }}
            >
              {t.value}
            </div>
          </div>
        ))}

        {phase !== 'playing' && (
          <Overlay
            phase={phase}
            score={score}
            onRestart={start}
            onContinue={() => {
              setKeepPlaying(true);
              setPhase('playing');
            }}
          />
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        استخدم الأسهم أو WASD أو اسحب بإصبعك على اللوحة.
      </p>
    </div>
  );
}

/**
 * Place a cell on the board. `--sz-2048-pitch` is the distance to the next
 * cell, expressed in this element's own width plus the gap, so multiplying a
 * cell index by it lands exactly on the right slot. The maths lives in
 * `resources/css/app.css` under `.sz-2048-cell`.
 */
const at = (col: number, row: number) =>
  `translate(calc(${col} * var(--sz-2048-pitch)), calc(${row} * var(--sz-2048-pitch)))`;

function Overlay({
  phase,
  score,
  onRestart,
  onContinue,
}: {
  phase: Exclude<Phase, 'playing'>;
  score: number;
  onRestart: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-background/80 backdrop-blur-[2px]">
      {phase === 'won' ? (
        <>
          <p className="text-2xl font-black text-primary">وصلت إلى {TARGET}!</p>
          <p className="text-sm text-muted-foreground">نقاطك: {score}</p>
          <div className="flex gap-2">
            <Button onClick={onContinue}>متابعة اللعب</Button>
            <Button variant="outline" onClick={onRestart}>
              لعبة جديدة
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-2xl font-black text-destructive">لا توجد حركات</p>
          <p className="text-sm text-muted-foreground">نقاطك: {score}</p>
          <Button onClick={onRestart}>حاول مجدداً</Button>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'primary' }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl border border-border/60 bg-card/60 px-2 py-2">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <span
        dir="ltr"
        className={`font-mono text-lg font-black tabular-nums ${
          tone === 'primary' ? 'text-primary' : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function Game2048Rules() {
  return (
    <>
      <ul className="list-disc space-y-1 ps-5">
        <li>حرّك المربعات بالأسهم أو بالسحب، وعلى الجوال اسحب بإصبعك في الاتجاه المطلوب.</li>
        <li>المربّعان المتشابهان يندمجان عند تحريكهما نحو بعضهما، وتُجمع قيمتهما في مربّع واحد.</li>
        <li>الهدف بلوغ المربّع ٢٠٤٨، ويمكنك متابعة اللعب بعده إن أردت.</li>
        <li>تنتهي الجولة عندما تمتلئ الشبكة دون أي اندماج ممكن.</li>
        <li>أفضل نتيجة تُحفظ على جهازك.</li>
      </ul>
    </>
  );
}
