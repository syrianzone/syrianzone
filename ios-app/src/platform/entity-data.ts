import type { Page } from '../domain';
import { array, integer, record } from './validation';

export const positiveId = (value: unknown): number => { const id = integer(value); if (id < 1) throw new Error('المعرّف غير صالح.'); return id; };
export const nonnegative = (value: unknown): number => { const result = integer(value); if (result < 0) throw new Error('العدد غير صالح.'); return result; };
export function pageOf<T>(value: unknown, decode: (item: unknown) => T): Page<T> {
  const row = record(value);
  return { items: array(row.data).map(decode), currentPage: positiveId(row.current_page), lastPage: positiveId(row.last_page), total: nonnegative(row.total) };
}
