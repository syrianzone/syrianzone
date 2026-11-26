import { useSyncExternalStore } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { colsAt } from '../_lib/layout';
import { findWidget } from '../_lib/registry';
import type { Breakpoint, WidgetInstance, WidgetSize } from '../_lib/types';
import { BoardTile } from './BoardTile';

export const ROW_HEIGHT = 76;

// media-query hook rather than md:/lg: utilities: the code-split css chunks each
// emit their own tailwind layer, so responsive classes lose cascade order in a
// page chunk (same reason Places/Lightbox.tsx does this). Column count is data
// here anyway, since spans are computed from it.
//
// useSyncExternalStore with a server snapshot: the server has no viewport, so
// it renders 'lg', and hydration must start from that same value before the
// client's real breakpoint takes over (reading matchMedia during the first
// render would make the client's tree differ from the server HTML).
export function useBreakpoint(): Breakpoint {
  return useSyncExternalStore(subscribe, read, () => 'lg');
}

function subscribe(onChange: () => void): () => void {
  const md = window.matchMedia('(min-width: 768px)');
  const lg = window.matchMedia('(min-width: 1024px)');
  md.addEventListener('change', onChange);
  lg.addEventListener('change', onChange);
  return () => {
    md.removeEventListener('change', onChange);
    lg.removeEventListener('change', onChange);
  };
}

function read(): Breakpoint {
  if (typeof window === 'undefined') return 'lg';
  if (window.matchMedia('(min-width: 1024px)').matches) return 'lg';
  if (window.matchMedia('(min-width: 768px)').matches) return 'md';
  return 'sm';
}

const SR_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'لنقل الويدجت اضغط المسافة أو Enter، ثم حرّكه بالأسهم، واضغط المسافة أو Enter لإفلاته، أو Escape للإلغاء.',
};

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

  // dnd-kit's built-in announcements are English and speak raw instance ids.
  const nameOf = (id: UniqueIdentifier) => {
    const w = props.widgets.find((x) => x.i === id);
    return (w && findWidget(w.d)?.name) ?? 'الويدجت';
  };
  const positionOf = (id: UniqueIdentifier) =>
    `الموضع ${props.widgets.findIndex((x) => x.i === id) + 1} من ${props.widgets.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `التُقط ${nameOf(active.id)}، ${positionOf(active.id)}`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} فوق ${positionOf(over.id)}` : `${nameOf(active.id)} خارج اللوحة`,
    onDragEnd: ({ active, over }) =>
      over ? `أُفلت ${nameOf(active.id)} في ${positionOf(over.id)}` : `أُفلت ${nameOf(active.id)}`,
    onDragCancel: ({ active }) => `أُلغي نقل ${nameOf(active.id)}`,
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) props.onMove(String(active.id), String(over.id));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions: SR_INSTRUCTIONS }}
    >
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
