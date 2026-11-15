import type { QuranBookmark } from './bookmarks-model';
export function createGuestBookmarkStore(port: { read(): Promise<QuranBookmark[]>; write(value: QuranBookmark[]): Promise<void> }) {
  let tail = Promise.resolve();
  function enqueue<T>(work: () => Promise<T>): Promise<T> { const result = tail.then(work); tail = result.then(() => undefined, () => undefined); return result; }
  return { read: () => enqueue(port.read), mutate: (update: (previous: QuranBookmark[]) => QuranBookmark[]) => enqueue(async () => { const next = update(await port.read()); await port.write(next); return next; }) };
}
