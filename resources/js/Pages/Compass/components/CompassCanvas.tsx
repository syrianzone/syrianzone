import React from 'react';
import type { AxisId } from '../data/types';

// A 1:1 square compass: central_federal (X) × auth_lib (Y), with the user plotted.
// Mobile-first: fills its container's width and stays square via aspect-ratio.
export default function CompassCanvas({
  axes,
}: {
  axes: Partial<Record<AxisId, number | null>>;
}) {
  const x = axes.central_federal ?? 0;
  const y = axes.auth_lib ?? 0;
  const hasX = axes.central_federal != null;
  const hasY = axes.auth_lib != null;

  // central_federal: مركزي يمين · لامركزي يسار (mirrors the axis bar), while
  // auth_lib keeps حرية أعلى · سلطوية أسفل.
  const left = ((1 - x) / 2) * 100;
  const top = (1 - (y + 1) / 2) * 100;

  return (
    <div className="mx-auto w-full max-w-xs">
      <div
        className="relative w-full rounded-xl border border-border"
        style={{
          aspectRatio: '1 / 1',
          background: 'radial-gradient(circle at 50% 50%, hsl(var(--muted) / 0.5), transparent 70%)',
        }}
      >
        {/* grid lines */}
        <div className="absolute left-0 right-0 top-1/2 h-px bg-border" />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border" />
        {/* poles */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">تحرّرية/مدنية</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">سلطوية</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">مركزي/وحدوي</span>
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">لامركزي/فدرالي</span>
        {/* user dot */}
        {hasX && hasY && (
          <>
            <div
              className="absolute w-4 h-4 rounded-full bg-primary border-2 border-background shadow -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${left}%`, top: `${top}%` }}
            />
            <span
              className="absolute text-[10px] font-bold text-primary -translate-x-1/2"
              style={{ left: `${left}%`, top: `calc(${top}% - 18px)` }}
            >
              أنت
            </span>
          </>
        )}
      </div>
    </div>
  );
}
