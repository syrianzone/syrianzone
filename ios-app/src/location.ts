import type { Coordinate } from './domain';

interface LocationSubscription { remove(): void }
type WatchLocation = (onPosition: (coordinate: Coordinate) => void, onError: () => void) => Promise<LocationSubscription>;

export function firstLocation(watch: WatchLocation, signal: AbortSignal, timeoutMs = 15_000): Promise<Coordinate> {
  return new Promise((resolve, reject) => {
    let subscription: LocationSubscription | undefined;
    let finished = false;
    function finish(coordinate?: Coordinate): void {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      subscription?.remove();
      if (coordinate) resolve(coordinate);
      else reject(new Error('تعذر تحديد الموقع. حاول مرة أخرى.'));
    }
    const abort = (): void => finish();
    const timer = setTimeout(abort, timeoutMs);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { finish(); return; }
    watch(coordinate => finish(coordinate), abort).then(value => {
      if (finished) value.remove();
      else subscription = value;
    }).catch(abort);
  });
}
