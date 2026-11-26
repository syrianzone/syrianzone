import { useEffect, useState } from 'react';

/**
 * The current time, ticking every `intervalMs` while the tab is visible.
 *
 * Null on the server and on the first client render, so a countdown never
 * renders the server's clock into HTML that the client then contradicts
 * (hydration mismatch). Hidden tabs stop ticking and catch up on return.
 */
export function useNow(intervalMs = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    let timer: number | null = null;
    const tick = () => setNow(new Date());
    const start = () => {
      if (timer !== null) return;
      tick();
      timer = window.setInterval(tick, intervalMs);
    };
    const stop = () => {
      if (timer === null) return;
      window.clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.visibilityState === 'hidden' ? stop() : start());

    if (document.visibilityState === 'hidden') tick();
    else start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);

  return now;
}
