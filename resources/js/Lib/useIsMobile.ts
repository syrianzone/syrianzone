import { useSyncExternalStore } from 'react';

/**
 * Tailwind's width breakpoints in px: the value is the breakpoint's min-width,
 * i.e. the number `md:` and `max-md:` are generated from.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/** The same question outside a component: the media query as the browser reads it. */
export function matchesMaxWidth(breakpoint: Breakpoint = 'md'): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`).matches;
}

function subscribeTo(breakpoint: Breakpoint) {
  return (onChange: () => void) => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  };
}

const SUBSCRIBERS = Object.fromEntries(
  (Object.keys(BREAKPOINTS) as Breakpoint[]).map((bp) => [bp, subscribeTo(bp)]),
) as Record<Breakpoint, (onChange: () => void) => () => void>;

const serverSnapshot = () => false;

/**
 * True while the viewport is narrower than `breakpoint` — Tailwind's
 * `max-<bp>` — for picking the mobile container (a bottom sheet instead of a
 * centred dialog) or the layout a narrow screen cannot fit. One hook, so a
 * viewport change is one edit rather than a threshold per surface.
 *
 * The server and the hydrating render report the wide variant (`false`), so the
 * hydrated markup matches what SSR sent; React re-renders with the real answer
 * immediately after hydration, and a later client-only mount reads it at once.
 */
export function useIsMobile(breakpoint: Breakpoint = 'md'): boolean {
  return useSyncExternalStore(
    SUBSCRIBERS[breakpoint],
    () => matchesMaxWidth(breakpoint),
    serverSnapshot,
  );
}
