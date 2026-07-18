import { useEffect, useState } from 'react';
import { colsAt, spanAt } from '../_lib/layout';
import type { Breakpoint, WidgetInstance } from '../_lib/types';
import { BoardTile } from './BoardTile';

export const ROW_HEIGHT = 76;

// media-query hook rather than md:/lg: utilities: the code-split css chunks each
// emit their own tailwind layer, so responsive classes lose cascade order in a
// page chunk (same reason Places/Lightbox.tsx does this). Column count is data
// here anyway, since spans are computed from it.
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(() => read());

  useEffect(() => {
    const md = window.matchMedia('(min-width: 768px)');
    const lg = window.matchMedia('(min-width: 1024px)');
    const sync = () => setBp(read());
    md.addEventListener('change', sync);
    lg.addEventListener('change', sync);
    return () => {
      md.removeEventListener('change', sync);
      lg.removeEventListener('change', sync);
    };
  }, []);

  return bp;
}

function read(): Breakpoint {
  if (typeof window === 'undefined') return 'lg';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'lg';
  if (window.matchMedia('(min-width: 768px)').matches) return 'md';
  return 'sm';
}

// grid-auto-flow: dense packs the row, so a narrow widget backfills the gap left
// by a wider one. Position is array order; there is no x/y and no compaction.
export function BoardGrid(props: {
  widgets: WidgetInstance[];
  breakpoint: Breakpoint;
  editing: boolean;
  onRemove: (instanceId: string) => void;
  onConfigChange: (instanceId: string, patch: Record<string, unknown>) => void;
}) {
  const cols = colsAt(props.breakpoint);

  return (
    <div
      dir="rtl"
      className="grid gap-3 [grid-auto-flow:dense]"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: `${ROW_HEIGHT}px`,
      }}
    >
      {props.widgets.map((w) => (
        <div
          key={w.i}
          style={{ gridColumn: `span ${spanAt(w.w, props.breakpoint)}`, gridRow: `span ${w.h}` }}
        >
          <BoardTile
            widget={w}
            breakpoint={props.breakpoint}
            editing={props.editing}
            onRemove={() => props.onRemove(w.i)}
            onConfigChange={(patch) => props.onConfigChange(w.i, patch)}
          />
        </div>
      ))}
    </div>
  );
}
