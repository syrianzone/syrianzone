import { expect, test } from 'bun:test';
import { createGuestBookmarkStore } from './bookmark-store';
import type { QuranBookmark } from './bookmarks-model';
test('accepted guest edits from two reader instances serialize against the newest saved list', async () => {
  let saved: QuranBookmark[] = [];
  const store = createGuestBookmarkStore({ read: async () => saved, write: async value => { await new Promise(resolve => setTimeout(resolve, 0)); saved = value; } });
  const a = { surah: 1, ayah: 1, page: 1, juz: 1 }, b = { ...a, ayah: 2 };
  const first = store.mutate(previous => [a, ...previous]), second = store.mutate(previous => [b, ...previous]);
  await Promise.all([first, second]); expect(await store.read()).toEqual([b, a]);
});
