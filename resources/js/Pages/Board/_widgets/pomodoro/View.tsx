import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/Components/ui/button';
import { WidgetShell } from '../../_components/WidgetShell';
import type { WidgetProps } from '../../_lib/types';
import type { PomodoroConfig } from './index';

type Phase = 'work' | 'rest';

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// No query: only the durations live in the layout config, so they sync for free.
//
// The running countdown is deliberately NOT persisted to the document. Writing
// it would sync a half finished timer to every other device and push a document
// write every second through the sync layer. It is React state only and resets
// on reload. Do not "fix" this by moving it into `c`.
export default function PomodoroView({ config }: WidgetProps<PomodoroConfig>) {
  const workMin = clamp(config.work, 5, 90, 25);
  const restMin = clamp(config.rest, 1, 30, 5);

  const [phase, setPhase] = useState<Phase>('work');
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(workMin * 60000);
  // absolute target, so the countdown does not drift when a background tab
  // throttles the interval below 1Hz
  const endAt = useRef<number | null>(null);

  const total = (phase === 'work' ? workMin : restMin) * 60000;

  // a duration change or a phase switch always rearms the clock from scratch
  useEffect(() => {
    setRunning(false);
    endAt.current = null;
    setRemaining(total);
  }, [total, phase]);

  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => {
      const left = (endAt.current ?? 0) - Date.now();
      if (left <= 0) {
        endAt.current = null;
        setRemaining(0);
        setRunning(false);
        return;
      }
      setRemaining(left);
    }, 250);
    return () => window.clearInterval(tick);
  }, [running]);

  function start() {
    if (remaining <= 0) return;
    endAt.current = Date.now() + remaining;
    setRunning(true);
  }

  function pause() {
    endAt.current = null;
    setRunning(false);
  }

  function reset() {
    endAt.current = null;
    setRunning(false);
    setRemaining(total);
  }

  const elapsed = total > 0 ? Math.min(1, (total - remaining) / total) : 0;

  return (
    <WidgetShell title="مؤقّت بومودورو" icon={Timer}>
      <div dir="rtl" className="flex h-full flex-col items-center justify-center gap-2 p-3">
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => setPhase('work')}
            aria-pressed={phase === 'work'}
            className={`rounded px-2 py-0.5 text-xs ${phase === 'work' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            عمل
          </button>
          <button
            type="button"
            onClick={() => setPhase('rest')}
            aria-pressed={phase === 'rest'}
            className={`rounded px-2 py-0.5 text-xs ${phase === 'rest' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            راحة
          </button>
        </div>

        <p dir="ltr" className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
          {mmss(remaining)}
        </p>

        <div className="h-1 w-full max-w-40 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${elapsed * 100}%` }} />
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={running ? pause : start} disabled={!running && remaining <= 0}>
            {running ? <Pause className="ms-1 h-3.5 w-3.5" /> : <Play className="ms-1 h-3.5 w-3.5" />}
            {running ? 'إيقاف مؤقت' : 'ابدأ'}
          </Button>
          <Button type="button" variant="ghost" size="sm" aria-label="إعادة ضبط" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </WidgetShell>
  );
}
