import { useEffect, useState } from 'react';

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

/**
 * True while the viewport is narrower than `breakpoint` — Tailwind's
 * `max-<bp>` — for picking the mobile container (a bottom sheet instead of a
 * centred dialog) or the layout a narrow screen cannot fit. One hook, so a
 * viewport change is one edit rather than a threshold per surface.
 *
 * The first client render already knows the answer (no layout flash); the server
 * renders the wide variant, and the surfaces that ask switch between two
 * closed-by-default containers, so hydration still matches.
 */
export function useIsMobile(breakpoint: Breakpoint = 'md'): boolean {
  const [mobile, setMobile] = useState(() => matchesMaxWidth(breakpoint));

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${BREAKPOINTS[breakpoint] - 1}px)`);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return mobile;
}
