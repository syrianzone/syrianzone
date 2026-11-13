import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

/**
 * Leaflet measures its container when it mounts and never again. Panels that
 * open, a tab that becomes visible or a window resize leave it with a stale
 * size (grey bands, clicks landing off target), so keep it in sync with the
 * container's real size instead of guessing with a timeout.
 */
export function useInvalidateSizeOnLayout(): void {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    let frame = 0;

    const invalidate = () => {
      frame = 0;
      map.invalidateSize();
    };
    // Coalesce a burst of resize notifications into the next frame.
    const schedule = () => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(invalidate);
    };

    schedule();
    if (typeof ResizeObserver === 'undefined') return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, [map]);
}
