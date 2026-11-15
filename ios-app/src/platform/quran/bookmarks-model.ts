import { array, integer, record } from '../validation';
import { ayahCounts } from './source-rules';

export interface QuranBookmark { surah: number; ayah: number; page: number; juz: number }
export const bookmarkKey = (item: Pick<QuranBookmark, 'surah' | 'ayah'>): string => `${item.surah}:${item.ayah}`;
export function decodeBookmarks(value: unknown): QuranBookmark[] {
  return array(value).slice(0, 250).map(raw => {
    const item = record(raw), surah = integer(item.surah), ayah = integer(item.ayah), page = integer(item.page), juz = integer(item.juz);
    if (surah < 1 || surah > 114 || ayah < 1 || ayah > (ayahCounts[surah] ?? 0) || page < 1 || page > 604 || juz < 1 || juz > 30) throw new Error('بيانات العلامات غير صالحة.');
    return { surah, ayah, page, juz };
  });
}
export function unionBookmarks(server: readonly QuranBookmark[], guest: readonly QuranBookmark[]): QuranBookmark[] {
  const seen = new Set<string>();
  return [...server, ...guest].filter(item => { const key = bookmarkKey(item); if (seen.has(key)) return false; seen.add(key); return true; });
}
export function toggleGuest(saved: readonly QuranBookmark[], item: QuranBookmark): QuranBookmark[] {
  const key = bookmarkKey(item), exists = saved.some(value => bookmarkKey(value) === key);
  return exists ? saved.filter(value => bookmarkKey(value) !== key) : [item, ...saved].slice(0, 50);
}
