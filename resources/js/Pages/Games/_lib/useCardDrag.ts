import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** How far the pointer must travel before a press becomes a drag, not a tap. */
const DRAG_THRESHOLD_PX = 8;
/** How long the click that follows a release stays swallowed. */
const SWALLOW_MS = 500;

interface CardDragState<T> {
  payload: T;
  /** Viewport position and width of the ghost, so it stays under the pointer. */
  x: number;
  y: number;
  w: number;
}

interface UseCardDragOptions<T> {
  /** Once the pointer passes the threshold; the drop highlight starts here. */
  onDragStart?: (payload: T) => void;
  /** On every move with the element under the pointer (the hover highlight). */
  onOver?: (element: Element | null) => void;
  /** On release after a real drag; the synthetic click is swallowed. */
  onDrop: (element: Element | null, payload: T) => void;
  /** When the gesture ends, before `onDrop` and even when it was only a tap. */
  onDragEnd?: () => void;
}

/** The element under the pointer at release, so each game resolves its own drop zone. */
function elementUnder(clientX: number, clientY: number): Element | null {
  const element = document.elementFromPoint(clientX, clientY);
  return element instanceof Element ? element : null;
}

/**
 * Pointer-based card dragging, shared by the card games: mouse, touch and pen
 * alike (native HTML5 drag never fires on touch). A move only starts after an
 * 8px threshold, so a tap still falls through to the click handler; a real drag
 * attaches a one-shot capturing click listener so the release does not also
 * select or play the card. Each game supplies only its payload, its drop
 * resolution and what a drop means.
 *
 * It also owns the pointer kind, because that is what makes a tap mean two
 * things on a touch screen: the first tap picks a card, a second tap on the
 * same card plays it, and a mouse (or a keyboard activation, which sends no
 * pointer event) plays at once. `isTouchPick` is that rule.
 */
export function useCardDrag<T>({ onDragStart, onOver, onDrop, onDragEnd }: UseCardDragOptions<T>) {
  const gesture = useRef<{
    payload: T;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    width: number;
    active: boolean;
  } | null>(null);
  const [drag, setDrag] = useState<CardDragState<T> | null>(null);
  /** The kind of the last press, so the click that follows it knows what it is. */
  const pointerType = useRef('');

  const startDrag = (e: ReactPointerEvent, payload: T) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pointerType.current = e.pointerType;
    gesture.current = {
      payload,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      width: rect.width,
      active: false,
    };

    const move = (ev: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      if (!g.active) {
        if (Math.hypot(ev.clientX - g.startX, ev.clientY - g.startY) < DRAG_THRESHOLD_PX) return;
        g.active = true;
        onDragStart?.(g.payload);
      }
      if (ev.cancelable) ev.preventDefault();
      setDrag({ payload: g.payload, x: ev.clientX - g.grabX, y: ev.clientY - g.grabY, w: g.width });
      onOver?.(elementUnder(ev.clientX, ev.clientY));
    };

    const release = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      const g = gesture.current;
      gesture.current = null;
      setDrag(null);
      onDragEnd?.();
      if (!g?.active) return; // a tap falls through to onClick

      const swallow = (ce: Event) => {
        ce.stopPropagation();
        ce.preventDefault();
        window.removeEventListener('click', swallow, true);
      };
      window.addEventListener('click', swallow, true);
      window.setTimeout(() => window.removeEventListener('click', swallow, true), SWALLOW_MS);

      onDrop(elementUnder(ev.clientX, ev.clientY), g.payload);
    };

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
  };

  return {
    drag,
    startDrag,
    /**
     * Whether the click that just landed is the picking half of the touch
     * gesture: a touch screen picks with the first tap and plays with the
     * second, while a mouse click — and a keyboard activation, which produces
     * no pointer event — plays at once. `picked` is the card already shown as
     * selected.
     */
    isTouchPick: (picked: boolean) => pointerType.current === 'touch' && !picked,
  };
}
