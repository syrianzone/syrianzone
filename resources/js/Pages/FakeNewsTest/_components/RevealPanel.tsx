import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Pause,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader } from '@/Components/ui/card';
import { Separator } from '@/Components/ui/separator';
import type { AnswerRecord, FakeNewsClaim } from '@/Domain/fakenewstest/types';
import { cn } from '@/Lib/utils';
import BdiText from './BdiText';
import KindBadge from './KindBadge';

interface RevealPanelProps {
  claim: FakeNewsClaim;
  userAnswer: boolean;
  answers: readonly AnswerRecord[];
  order: readonly string[];
  index: number;
  total: number;
  onNext: () => void;
}

const DISMISS_DISTANCE_PX = 80;
const DISMISS_VELOCITY_PX_MS = 0.42;
const DISMISS_MIN_FLICK_PX = 34;
const TAP_MAX_DISTANCE_PX = 10;
const FLY_OUT_MS = 200;
// Long enough to read the claim and its explanation: a base plus a per-character
// allowance, capped so a forgotten tab still moves on.
const AUTO_DISMISS_BASE_MS = 4000;
const AUTO_DISMISS_PER_CHAR_MS = 45;
const AUTO_DISMISS_MAX_MS = 20000;

function autoDismissMs(claim: FakeNewsClaim): number {
  const chars = claim.text.length + claim.explain.length;
  return Math.min(AUTO_DISMISS_MAX_MS, AUTO_DISMISS_BASE_MS + chars * AUTO_DISMISS_PER_CHAR_MS);
}

export default function RevealPanel({
  claim,
  userAnswer,
  answers,
  order,
  index,
  total,
  onNext,
}: RevealPanelProps) {
  const isCorrect = userAnswer === claim.answer;
  const isLast = index + 1 >= total;
  const dismissAfterMs = autoDismissMs(claim);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [flyVector, setFlyVector] = useState<{ x: number; y: number } | null>(null);
  const [remainingMs, setRemainingMs] = useState(dismissAfterMs);
  const [timerStopped, setTimerStopped] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; time: number; pointerId: number } | null>(null);
  const committedRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const answerMap = useMemo(() => {
    const map = new Map<string, AnswerRecord>();
    for (const a of answers) map.set(a.claimId, a);
    return map;
  }, [answers]);

  useEffect(() => {
    committedRef.current = false;
    dragStartRef.current = null;
    setDragging(false);
    setFlyVector(null);
    setOffset({ x: 0, y: 0 });
    setRemainingMs(dismissAfterMs);
    setTimerStopped(false);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [claim.id, dismissAfterMs]);

  const dismissCard = useCallback(
    (vx = -1, vy = 0) => {
      if (committedRef.current) return;
      committedRef.current = true;
      setDragging(false);
      const len = Math.hypot(vx, vy) || 1;
      // Unit vector scaled in the viewport's own units, so the card leaves the screen.
      setFlyVector({
        x: (vx / len) * 100,
        y: (vy / len) * 100,
      });
      timerRef.current = window.setTimeout(() => {
        onNext();
      }, FLY_OUT_MS);
    },
    [onNext],
  );

  // Auto-dismiss after a reading-length delay (pauses while dragging, stops when tapped, clicked or scrolled)
  useEffect(() => {
    if (dragging || timerStopped || flyVector !== null || committedRef.current) return;
    lastTickRef.current = performance.now();

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      setRemainingMs((prev) => {
        const next = Math.max(0, prev - delta);
        if (next === 0 && !committedRef.current) {
          dismissCard(-1, 0);
        }
        return next;
      });
    }, 50);

    return () => window.clearInterval(intervalId);
  }, [dragging, timerStopped, flyVector, dismissCard, claim.id]);

  // Scrolling with a wheel or trackpad means the reader is reading: stop the
  // countdown. (Touch scrolling cancels the pointer drag and is handled there.)
  useEffect(() => {
    if (timerStopped) return;
    const handleWheel = () => {
      if (!committedRef.current) setTimerStopped(true);
    };
    window.addEventListener('wheel', handleWheel, { passive: true });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [timerStopped, claim.id]);

  // Keyboard shortcuts: Enter / Space / Arrow keys dismiss to next card
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (committedRef.current || e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'A' ||
          target.tagName === 'BUTTON' ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SUMMARY')
      ) {
        return;
      }

      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowLeft') {
        e.preventDefault();
        dismissCard(-1, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        dismissCard(1, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        dismissCard(0, -1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        dismissCard(0, 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dismissCard]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (committedRef.current) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('a, button')) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Without capture a release off the card never reaches us and the card
      // would stay displaced with the countdown paused, so don't start a drag.
      // The reader touched the card, so treat it as a tap: stop the countdown.
      setTimerStopped(true);
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
      // A cancel is usually the browser taking over to scroll: the reader is
      // reading, so stop the countdown rather than restart it.
      if (cancelled && !committedRef.current) setTimerStopped(true);
      setDragging(false);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dist = Math.hypot(dx, dy);
    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = dist / elapsed;

    if (dist >= DISMISS_DISTANCE_PX || (velocity >= DISMISS_VELOCITY_PX_MS && dist >= DISMISS_MIN_FLICK_PX)) {
      dismissCard(dx, dy);
    } else {
      if (dist <= TAP_MAX_DISTANCE_PX) {
        setTimerStopped(true);
      }
      setDragging(false);
      setOffset({ x: 0, y: 0 });
    }
  };

  const dragDistance = Math.hypot(offset.x, offset.y);
  const dragOpacity = flyVector ? 0 : Math.max(0.45, 1 - dragDistance / 360);
  const cardTransform = flyVector
    ? `translate3d(${flyVector.x}vw, ${flyVector.y}vh, 0) rotate(${flyVector.x * 0.18}deg)`
    : `translate3d(${offset.x}px, ${offset.y}px, 0) rotate(${offset.x * 0.04}deg)`;

  const remainingPct = Math.max(0, Math.min(100, (remainingMs / dismissAfterMs) * 100));
  const sources = [claim.source, ...(claim.source2 ? [claim.source2] : [])];

  return (
    <section
      className="mx-auto flex min-h-[calc(100svh-var(--sz-navbar-h,4rem)-1rem)] max-w-md flex-col justify-between px-4 py-4 sm:py-6"
      aria-labelledby="fakenewstest-reveal-title"
    >
      {/* Matching Story-Style Progress Bar */}
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
            id="fakenewstest-reveal-title"
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

      {/* Swipeable Reveal Card (auto-dismisses after a reading-length delay, or swipe in any direction) */}
      <div className="relative my-4 flex flex-1 items-center justify-center py-2">
        <div className="relative w-full">
          {!isLast && (
            <Card
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-0 rounded-2xl bg-card transition-transform duration-300',
                flyVector
                  ? 'scale-100 translate-y-0 rotate-0 opacity-100'
                  : 'scale-[0.95] translate-y-2.5 rotate-[1.5deg] opacity-75',
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
              transform: cardTransform,
              opacity: dragOpacity,
            }}
            className={cn(
              'relative z-10 overflow-hidden rounded-2xl shadow-md touch-pan-y select-none cursor-grab active:cursor-grabbing',
              isCorrect ? 'border-emerald-500/40' : 'border-destructive/40',
              dragging
                ? 'transition-none'
                : flyVector
                  ? 'transition-all duration-200 ease-in'
                  : 'transition-transform duration-300 ease-out',
            )}
          >
            <CardHeader
              className={cn(
                'flex-row items-center justify-between space-y-0 px-5 py-3.5',
                isCorrect
                  ? 'bg-emerald-500/10 text-emerald-900 dark:text-emerald-100'
                  : 'bg-destructive/10 text-foreground',
              )}
            >
              <div className="flex items-center gap-2">
                {isCorrect ? (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
                )}
                <span className="text-base font-bold">
                  {isCorrect ? 'أصبت!' : 'انطلت عليك!'}
                </span>
              </div>

              <Badge
                variant={claim.answer ? 'secondary' : 'destructive'}
                className={cn(
                  'font-bold',
                  claim.answer &&
                    'border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
                )}
              >
                {claim.label}
              </Badge>
            </CardHeader>

            <Separator />

            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <KindBadge kind={claim.kind} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  <bdi dir="ltr">{claim.date}</bdi>
                </span>
              </div>

              {claim.image && (
                <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
                  <img
                    src={claim.image}
                    alt={claim.imageAlt ?? claim.text}
                    draggable={false}
                    loading="eager"
                    decoding="async"
                    className="pointer-events-none max-h-36 w-full object-contain"
                  />
                </div>
              )}

              <p className="text-base sm:text-lg font-bold leading-relaxed text-foreground">
                <BdiText text={claim.text} />
              </p>

              <p className="rounded-lg bg-muted/50 p-3.5 text-sm leading-relaxed text-foreground/90">
                <BdiText text={claim.explain} />
              </p>

              {/* Reading-length auto-dismiss timer. Tapping the card stops it; the
                  button is the keyboard and screen-reader equivalent (WCAG 2.2.1). */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <button
                    type="button"
                    aria-pressed={timerStopped}
                    onClick={() => setTimerStopped((stopped) => !stopped)}
                    className={cn(
                      'inline-flex min-h-6 items-center gap-1 rounded-sm font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      timerStopped && 'text-foreground',
                    )}
                  >
                    <Pause className="h-3 w-3" aria-hidden="true" />
                    <span>إيقاف المؤقّت</span>
                  </button>
                  {!timerStopped && <span aria-hidden="true">أو اضغط على البطاقة</span>}
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-75 ease-linear',
                      timerStopped
                        ? 'bg-muted-foreground/40'
                        : isCorrect
                          ? 'bg-emerald-500'
                          : 'bg-destructive',
                    )}
                    style={{ width: `${remainingPct}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Primary button(s) for the source + subtle accessible dismiss fallback */}
      <div className="space-y-2 pb-2">
        <div className="flex flex-col gap-2">
          {sources.map((src) => (
            <Button key={src.url} variant="outline" size="lg" asChild className="w-full h-auto min-h-11 py-2.5 gap-2 font-semibold">
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setTimerStopped(true)}
                onFocus={() => setTimerStopped(true)}
                className="inline-flex items-center justify-center gap-2 text-center whitespace-normal"
              >
                <ExternalLink className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-xs sm:text-sm leading-snug">
                  <BdiText text={src.title} />
                </span>
              </a>
            </Button>
          ))}
        </div>

        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => dismissCard(-1, 0)}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{isLast ? 'عرض نتيجتك' : 'اسحب البطاقة أو اضغط للمتابعة'}</span>
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
