import type { Page } from '../domain';
export function appendPage<T extends { id: number | string }>(current: Page<T>, next: Page<T>): Page<T> {
  if (next.currentPage !== current.currentPage + 1) throw new Error('أعاد الخادم صفحة غير متوقعة. حاول تحميل القائمة مجدداً.');
  const known = new Set(current.items.map(item => item.id));
  return { ...next, items: [...current.items, ...next.items.filter(item => { if (known.has(item.id)) return false; known.add(item.id); return true; })] };
}
