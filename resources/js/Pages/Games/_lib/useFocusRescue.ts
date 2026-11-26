import { useEffect, useRef } from 'react';

/** Buttons a keyboard user can land on: not disabled, not inside an inert subtree. */
const FOCUSABLE = 'button:not([disabled])';

function isGone(el: HTMLElement): boolean {
  return !el.isConnected || (el as HTMLButtonElement).disabled === true;
}

/**
 * Keep keyboard focus on the table when the control that had it disappears.
 *
 * A card table re-renders its controls every turn: a played card leaves the
 * hand, the bidding buttons give way to "كمّل", the contract list closes. The
 * focused button unmounts and focus falls to <body>, so a keyboard or screen
 * reader user starts over from the top of the page after every move.
 *
 * The hook remembers the last focused element inside the root and, if it was
 * inside a `[data-focus-group]`, its index there. After each render, if that
 * element is gone (or disabled) and nothing else has focus, it moves focus to
 * the same group at the nearest index, else to the first enabled button in the
 * fallback selectors, in order. Focus a user put elsewhere is never taken.
 */
export function useFocusRescue<T extends HTMLElement>(fallbacks: string[]) {
  const root = useRef<T | null>(null);
  const last = useRef<{ el: HTMLElement; group: string | null; index: number } | null>(null);

  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement;
      const groupEl = el.closest<HTMLElement>('[data-focus-group]');
      const group = groupEl && node.contains(groupEl) ? groupEl.dataset.focusGroup ?? null : null;
      const index = groupEl ? Array.from(groupEl.querySelectorAll<HTMLElement>(FOCUSABLE)).indexOf(el) : -1;
      last.current = { el, group, index };
    };
    node.addEventListener('focusin', onFocusIn);
    return () => node.removeEventListener('focusin', onFocusIn);
  });

  // No dependency list on purpose: any render can be the one that removed it.
  useEffect(() => {
    const node = root.current;
    const prev = last.current;
    if (!node || !prev || !isGone(prev.el)) return;
    const active = document.activeElement;
    if (active && active !== document.body && node.ownerDocument.contains(active)) return;

    let target: HTMLElement | null = null;
    if (prev.group) {
      const groupEl = node.querySelector<HTMLElement>(`[data-focus-group="${prev.group}"]`);
      const items = groupEl ? Array.from(groupEl.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];
      if (items.length > 0) target = items[Math.min(Math.max(prev.index, 0), items.length - 1)];
    }
    for (const selector of fallbacks) {
      if (target) break;
      target = node.querySelector<HTMLElement>(`${selector} ${FOCUSABLE}`);
    }
    if (target) {
      target.focus();
    } else {
      // Nothing to land on yet (an AI seat is thinking): forget it, so the
      // next render does not jump focus long after the player moved on.
      last.current = null;
    }
  });

  return root;
}
