import React from 'react';
import type { AxisId } from '../data/types';
import { AXES } from '../data/axes';
import { axisDisplay } from '../lib/axisDisplay';

const fmt = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

// One horizontal bar per axis: a center tick at 0, a primary-coloured fill
// toward the user's side, and a single pole label at each end. No title, no
// arrow, no red — direction follows `AXIS_MIRRORED`.
export default function AxisBars({ axes }: { axes: Partial<Record<AxisId, number | null>> }) {
  return (
    <div className="space-y-4">
      {AXES.map((a) => {
        const v = axes[a.id];
        const has = v != null;
        const val = has ? (v as number) : 0;
        const { leftLabel, rightLabel, positiveOnLeft } = axisDisplay(a);
        const pct = Math.min(Math.abs(val), 1) * 50;
        const fillOnLeft = val >= 0 === positiveOnLeft;

        return (
          <div key={a.id}>
            <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
              <span className="truncate font-medium text-foreground/90">{rightLabel}</span>
              <span className="shrink-0 font-mono text-primary">{has ? fmt(val) : '—'}</span>
              <span className="truncate font-medium text-foreground/90">{leftLabel}</span>
            </div>
            <div className="relative h-2 bg-muted rounded-full">
              <div className="absolute left-1/2 top-[-2px] bottom-[-2px] w-px bg-border" />
              {has && pct > 0 && (
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-primary"
                  style={
                    fillOnLeft
                      ? { right: '50%', width: `${pct}%` }
                      : { left: '50%', width: `${pct}%` }
                  }
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
