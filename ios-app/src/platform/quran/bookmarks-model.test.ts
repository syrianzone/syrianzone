import { expect, test } from 'bun:test';
import { decodeBookmarks, toggleGuest, unionBookmarks } from './bookmarks-model';

test('guest bookmarks retain 50 newest valid Ayahs and account union retains failed guest leftovers', () => {
  let saved = decodeBookmarks([]);
  for (let ayah = 1; ayah <= 60; ayah++) saved = toggleGuest(saved, { surah: 2, ayah, page: 2, juz: 1 });
  expect(saved).toHaveLength(50);
  expect(saved[0]?.ayah).toBe(60);
  expect(saved.at(-1)?.ayah).toBe(11);
  expect(toggleGuest(saved, saved[0]!)).toHaveLength(49);
  expect(unionBookmarks([saved[0]!], saved)).toHaveLength(50);
  expect(() => decodeBookmarks([{ surah: 114, ayah: 7, page: 604, juz: 30 }])).toThrow();
});
