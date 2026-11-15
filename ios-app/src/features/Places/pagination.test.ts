import { expect, test } from 'bun:test';
import { appendPage } from './pagination';
test('pagination keeps the existing page and removes repeated identities at a changing page boundary', () => {
  const current = { items: [{ id: 1 }, { id: 2 }], currentPage: 1, lastPage: 3, total: 5 };
  expect(appendPage(current, { items: [{ id: 2 }, { id: 3 }], currentPage: 2, lastPage: 3, total: 5 }).items.map(row => row.id)).toEqual([1, 2, 3]);
  expect(current.items).toHaveLength(2);
});
test('a wrong page acknowledgement cannot skip content or replace the current list', () => {
  expect(() => appendPage({ items: [{ id: 1 }], currentPage: 1, lastPage: 3, total: 3 }, { items: [{ id: 3 }], currentPage: 3, lastPage: 3, total: 3 })).toThrow();
});
