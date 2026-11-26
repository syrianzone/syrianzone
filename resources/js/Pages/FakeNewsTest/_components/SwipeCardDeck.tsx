import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import type { AnswerRecord, FakeNewsClaim } from '@/Domain/fakenewstest/types';
import { cn } from '@/Lib/utils';
import BdiText from './BdiText';
import KindBadge from './KindBadge';

interface SwipeCardDeckProps {
  claim: FakeNewsClaim;
  upcomingClaims: readonly FakeNewsClaim[];
  answers: readonly AnswerRecord[];
  order: readonly string[];
  index: number;
  total: number;
  onDecide: (answer: boolean) => void;
}

const SWIPE_THRESHOLD_PX = 85;
const FLICK_VELOCITY_PX_MS = 0.42;
const FLICK_MIN_PX = 36;
const FLY_OUT_MS = 220;

export default function SwipeCardDeck({
  claim,
  upcomingClaims,
  answers,
  order,
  index,
  total,
  onDecide,
}: SwipeCardDeckProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [flyOut, setFlyOut] = useState<'right' | 'left' | null>(null);

  const dragStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const committedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const answerMap = useMemo(() => {
    const map = new Map<string, AnswerRecord>();
    for (const a of answers) map.set(a.claimId, a);
    return map;
  }, [answers]);

  useEffect(() => {
    committedRef.current = false;
    dragStartRef.current = null;
    setDragging(false);
    setFlyOut(null);
    setOffset({ x: 0, y: 0 });
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [claim.id]);

  // Warm the cache for the next card's image so it doesn't pop in after the swipe.
  const nextImage = upcomingClaims[0]?.image;
  useEffect(() => {
    if (!nextImage) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = nextImage;
  }, [nextImage]);

  const triggerDecision = useCallback(
    (answer: boolean) => {
      if (committedRef.current) return;
      committedRef.current = true;
      setDragging(false);
      setFlyOut(answer ? 'right' : 'left');
      timerRef.current = window.setTimeout(() => {
        onDecide(answer);
      }, FLY_OUT_MS);
    },
    [onDecide],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (committedRef.current || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        triggerDecision(true);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        triggerDecision(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [triggerDecision]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (committedRef.current) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Without capture a release off the card never reaches us and the card
      // would stay displaced, so don't start a drag; the buttons and keys still work.
      return;
    }
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      pointerId: e.pointerId,
    };
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId || committedRef.current) return;
    setOffset({
      x: e.clientX - start.x,
      y: e.clientY - start.y,
    });
  };

  const finishPointer = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const start = dragStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;
    dragStartRef.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }

    if (cancelled || committedRef.current) {
      setDragging(false);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const dx = e.clientX - start.x;
    const elapsed = Math.max(1, performance.now() - start.time);
    const vx = dx / elapsed;

    const passedDistance = Math.abs(dx) >= SWIPE_THRESHOLD_PX;
    const passedFlick = Math.abs(vx) >= FLICK_VELOCITY_PX_MS && Math.abs(dx) >= FLICK_MIN_PX;

    if (passedDistance || passedFlick) {
      triggerDecision(dx > 0);
    } else {
      setDragging(false);
      setOffset({ x: 0, y: 0 });
    }
  };

  const rightRatio = flyOut === 'right' ? 1 : offset.x > 12 ? Math.min(1, (offset.x - 12) / 80) : 0;
  const leftRatio = flyOut === 'left' ? 1 : offset.x < -12 ? Math.min(1, (-offset.x - 12) / 80) : 0;

  const activeTransform =
    flyOut === 'right'
      ? 'translate3d(100vw, -24px, 0) rotate(18deg)'
      : flyOut === 'left'
        ? 'translate3d(-100vw, -24px, 0) rotate(-18deg)'
        : `translate3d(${offset.x}px, ${offset.y * 0.14}px, 0) rotate(${offset.x * 0.045}deg)`;

  const dragBorderClass =
    rightRatio > 0.15
      ? 'border-emerald-500'
      : leftRatio > 0.15
        ? 'border-destructive'
        : 'border-border';

  return (
    <section
      className="mx-auto flex min-h-[calc(100svh-var(--sz-navbar-h,4rem)-1rem)] max-w-md flex-col justify-between px-4 py-4 sm:py-6"
      aria-labelledby="fakenewstest-play-title"
    >
      {/* Story-style segmented progress bar */}
      <div className="space-y-2.5">
        <div
          className="flex items-center gap-1"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`البطاقة ${index + 1} من ${total}`}
        >
          {order.map((cid, i) => {
            const rec = answerMap.get(cid);
            const isCurrent = i === index;
            return (
              <span
                key={cid}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-200',
                  rec
                    ? rec.correct
                      ? 'bg-emerald-500'
                      : 'bg-destructive'
                    : isCurrent
                      ? 'bg-primary'
                      : 'bg-muted',
                )}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <h1
            id="fakenewstest-play-title"
            tabIndex={-1}
            className="text-sm font-bold text-muted-foreground focus:outline-none"
          >
            هل تميّزها؟
          </h1>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            <bdi dir="ltr">{index + 1} / {total}</bdi>
          </span>
        </div>
      </div>

      {/* Stacked shadcn Card Deck */}
      <div className="relative my-2 flex flex-1 items-center justify-center py-2 sm:my-4 sm:py-3">
        <div
          className={cn(
            'relative grid w-full',
            claim.image ? 'min-h-[min(22rem,56svh)] sm:min-h-[28rem]' : 'min-h-[min(18rem,48svh)] sm:min-h-[24rem]',
          )}
        >
          {upcomingClaims.length >= 2 && (
            <Card
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-2xl bg-muted/50 transition-transform duration-300 scale-[0.9] translate-y-5 -rotate-2 opacity-50"
            />
          )}

          {upcomingClaims.length >= 1 && (
            <Card
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-0 rounded-2xl bg-card transition-transform duration-300',
                flyOut
                  ? 'scale-100 translate-y-0 rotate-0 opacity-100'
                  : 'scale-[0.95] translate-y-2.5 rotate-[1.5deg] opacity-80',
              )}
            />
          )}

          <Card
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={(e) => finishPointer(e, false)}
            onPointerCancel={(e) => finishPointer(e, true)}
            onLostPointerCapture={(e) => finishPointer(e, true)}
            style={{
              transform: activeTransform,
              opacity: flyOut ? 0 : 1,
            }}
            className={cn(
              'relative z-10 flex w-full flex-col rounded-2xl border bg-card shadow-md touch-pan-y select-none cursor-grab active:cursor-grabbing',
              dragBorderClass,
              dragging
                ? 'transition-none'
                : flyOut
                  ? 'transition-all duration-200 ease-in'
                  : 'transition-transform duration-300 ease-out',
            )}
          >
            {/* Stamps sit on the trailing edge (صحيح on the left as the card leaves right,
                غير صحيح on the right as it leaves left), so they stay on screen. */}
            {/* Dynamic Tinder stamp: صحيح */}
            <div
              aria-hidden="true"
              style={{
                opacity: rightRatio,
                transform: `scale(${0.85 + rightRatio * 0.2}) rotate(-10deg)`,
              }}
              className="pointer-events-none absolute top-5 end-5 z-20 inline-flex items-center gap-1.5 rounded-lg border-2 border-emerald-500 bg-background px-3 py-1 text-base font-extrabold text-emerald-700 dark:text-emerald-300"
            >
              <Check className="h-4 w-4 stroke-[2.5]" />
              <span>صحيح</span>
            </div>

            {/* Dynamic Tinder stamp: غير صحيح */}
            <div
              aria-hidden="true"
              style={{
                opacity: leftRatio,
                transform: `scale(${0.85 + leftRatio * 0.2}) rotate(10deg)`,
              }}
              className="pointer-events-none absolute top-5 start-5 z-20 inline-flex items-center gap-1.5 rounded-lg border-2 border-destructive bg-background px-3 py-1 text-base font-extrabold text-destructive"
            >
              <X className="h-4 w-4 stroke-[2.5]" />
              <span>غير صحيح</span>
            </div>

            <CardContent className="flex flex-1 flex-col justify-between gap-3 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <KindBadge kind={claim.kind} />
                {index === 0 && !dragging && (
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center gap-0.5 text-muted-foreground/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                    <ChevronLeft className="h-4 w-4" />
                  </span>
                )}
              </div>

              {claim.image ? (
                <div className="my-auto flex flex-col gap-3">
                  <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                    <img
                      src={claim.image}
                      alt={claim.imageAlt ?? claim.text}
                      draggable={false}
                      loading="eager"
                      decoding="async"
                      className="pointer-events-none max-h-[min(11rem,24svh)] sm:max-h-52 w-full object-contain"
                    />
                  </div>
                  <p className="text-base sm:text-lg font-bold leading-relaxed text-foreground">
                    <BdiText text={claim.text} />
                  </p>
                </div>
              ) : (
                <div className="my-auto py-4">
                  <p className="text-xl sm:text-2xl font-bold leading-relaxed text-foreground">
                    <BdiText text={claim.text} />
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center pt-1" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-border" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Iconic Circular Tinder Action Bar using shadcn Buttons (no take-backs) */}
      <div className="pb-2 pt-1">
        <div className="flex items-center justify-center gap-10">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={flyOut !== null}
            onClick={() => triggerDecision(true)}
            aria-label="صحيح"
            title="صحيح"
            className={cn(
              'h-16 w-16 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 shadow-sm [&_svg]:size-6',
              rightRatio > 0.2 && 'scale-105 bg-emerald-500 text-white border-emerald-500',
            )}
          >
            <Check className="stroke-[2.5]" aria-hidden="true" />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={flyOut !== null}
            onClick={() => triggerDecision(false)}
            aria-label="غير صحيح"
            title="غير صحيح"
            className={cn(
              'h-16 w-16 rounded-full border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm [&_svg]:size-6',
              leftRatio > 0.2 && 'scale-105 bg-destructive text-destructive-foreground border-destructive',
            )}
          >
            <X className="stroke-[2.5]" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-3 hidden sm:block text-center text-[11px] text-muted-foreground">
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">→</kbd> صحيح ·{' '}
          <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">←</kbd> غير صحيح
        </p>
      </div>
    </section>
  );
}
