import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/** How far the pointer must travel before a press becomes a drag, not a tap. */
const DRAG_THRESHOLD_PX = 8;
/** How long the click that follows a release stays swallowed. */
const SWALLOW_MS = 500;

interface CardDragState<T> {
  payload: T;
  /**
   * Viewport position and width of the ghost when the drag started. Later
   * movement is applied to `ghostRef` directly, not through state.
   */
  x: number;
  y: number;
  w: number;
}

interface UseCardDragOptions<T> {
  /** Once the pointer passes the threshold; the drop highlight starts here. */
  onDragStart?: (payload: T) => void;
  /** At most once a frame, with the element under the pointer (the hover highlight). */
  onOver?: (element: Element | null) => void;
  /** On release after a real drag; the synthetic click is swallowed. */
  onDrop: (element: Element | null, payload: T) => void;
  /** When the gesture ends, before `onDrop`, even when it was only a tap or was cancelled. */
  onDragEnd?: () => void;
}

/** The element under the pointer at release, so each game resolves its own drop zone. */
function elementUnder(clientX: number, clientY: number): Element | null {
  const element = document.elementFromPoint(clientX, clientY);
  return element instanceof Element ? element : null;
}

/** Swallow the click the browser fires after a drag release. */
function swallowNextClick() {
  const swallow = (ce: Event) => {
    ce.stopPropagation();
    ce.preventDefault();
    window.removeEventListener('click', swallow, true);
  };
  window.addEventListener('click', swallow, true);
  window.setTimeout(() => window.removeEventListener('click', swallow, true), SWALLOW_MS);
}

/**
 * Pointer-based card dragging, shared by the card games: mouse, touch and pen
 * alike (native HTML5 drag never fires on touch). A move only starts after an
 * 8px threshold, so a tap still falls through to the click handler; a real drag
 * attaches a one-shot capturing click listener so the release does not also
 * select or play the card. Each game supplies only its payload, its drop
 * resolution and what a drop means.
 *
 * The game re-renders once when a drag starts and once when it ends. In
 * between, the ghost follows the pointer through `ghostRef` (a `translate`
 * written in an animation frame), so a drag does not re-render the board on
 * every pointermove. Only the pointer that started the gesture is followed,
 * a second finger cannot start another one, and Escape cancels it.
 *
 * It also owns the pointer kind, because that is what makes a tap mean two
 * things on a touch screen: the first tap picks a card, a second tap on the
 * same card plays it, and a mouse (or a keyboard activation, which sends no
 * pointer event) plays at once. `isTouchPick` is that rule.
 */
export function useCardDrag<T>({ onDragStart, onOver, onDrop, onDragEnd }: UseCardDragOptions<T>) {
  const gesture = useRef<{
    payload: T;
    pointerId: number;
    startX: number;
    startY: number;
    grabX: number;
    grabY: number;
    width: number;
    active: boolean;
  } | null>(null);
  const [drag, setDrag] = useState<CardDragState<T> | null>(null);
  /** The ghost element the game renders while `drag` is set. */
  const ghostRef = useRef<HTMLDivElement | null>(null);
  /** The kind of the last press, so the click that follows it knows what it is. */
  const pointerType = useRef('');
  /** Tears the current gesture's listeners down; also run on unmount. */
  const teardown = useRef<(() => void) | null>(null);

  useEffect(() => () => teardown.current?.(), []);

  const startDrag = (e: ReactPointerEvent, payload: T) => {
    // One gesture at a time: a second finger must not start another.
    if (gesture.current) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    pointerType.current = e.pointerType;
    const g = {
      payload,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      width: rect.width,
      active: false,
    };
    gesture.current = g;

    let frame = 0;
    let lastX = e.clientX;
    let lastY = e.clientY;

    const paint = () => {
      frame = 0;
      const ghost = ghostRef.current;
      if (ghost) ghost.style.translate = `${lastX - g.startX}px ${lastY - g.startY}px`;
      onOver?.(elementUnder(lastX, lastY));
    };

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== g.pointerId) return;
      if (!g.active) {
        if (Math.hypot(ev.clientX - g.startX, ev.clientY - g.startY) < DRAG_THRESHOLD_PX) return;
        g.active = true;
        // The ghost is placed at the press point; translate covers the rest.
        setDrag({ payload: g.payload, x: g.startX - g.grabX, y: g.startY - g.grabY, w: g.width });
        onDragStart?.(g.payload);
      }
      if (ev.cancelable) ev.preventDefault();
      lastX = ev.clientX;
      lastY = ev.clientY;
      if (!frame) frame = window.requestAnimationFrame(paint);
    };

    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', onKey, true);
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0;
      teardown.current = null;
      gesture.current = null;
      setDrag(null);
      onDragEnd?.();
    };

    const release = (ev: PointerEvent) => {
      if (ev.pointerId !== g.pointerId) return;
      end();
      if (!g.active) return; // a tap falls through to onClick
      swallowNextClick();
      onDrop(elementUnder(ev.clientX, ev.clientY), g.payload);
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.preventDefault();
      ev.stopPropagation();
      end();
      // The release still to come must not land as a click on whatever is under it.
      if (g.active) swallowNextClick();
    };

    teardown.current = end;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keydown', onKey, true);
  };

  return {
    drag,
    ghostRef,
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
