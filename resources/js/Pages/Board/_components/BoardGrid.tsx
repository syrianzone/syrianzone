import { useEffect, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { colsAt } from '../_lib/layout';
import type { Breakpoint, WidgetInstance, WidgetSize } from '../_lib/types';
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
//
// dnd-kit is transform-based, so it needs no RTL mirroring: CSS grid already
// flows right to left inside dir="rtl", and drag deltas follow the visual order.
export function BoardGrid(props: {
  widgets: WidgetInstance[];
  breakpoint: Breakpoint;
  editing: boolean;
  onMove: (fromId: string, toId: string) => void;
  onRemove: (instanceId: string) => void;
  onResize: (instanceId: string, size: WidgetSize) => void;
  onConfigure: (instanceId: string) => void;
  onConfigChange: (instanceId: string, patch: Record<string, unknown>) => void;
}) {
  const cols = colsAt(props.breakpoint);

  const sensors = useSensors(
    // 8px activation so a tap or a scroll on touch is not read as a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) props.onMove(String(active.id), String(over.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={props.widgets.map((w) => w.i)} strategy={rectSortingStrategy}>
        <div
          dir="rtl"
          className="grid gap-3 [grid-auto-flow:dense]"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gridAutoRows: `${ROW_HEIGHT}px`,
          }}
        >
          {props.widgets.map((w) => (
            <BoardTile
              key={w.i}
              widget={w}
              breakpoint={props.breakpoint}
              editing={props.editing}
              onRemove={() => props.onRemove(w.i)}
              onResize={(size) => props.onResize(w.i, size)}
              onConfigure={() => props.onConfigure(w.i)}
              onConfigChange={(patch) => props.onConfigChange(w.i, patch)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
