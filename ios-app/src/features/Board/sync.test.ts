import { expect, test } from 'bun:test';
import { defaultDocument } from './model';
import { createBoardWriter, documentBytes, pickWinner } from './sync';
test('whole document merge uses local ties and preserves a replaced local copy for recovery', () => {
  const local = { ...defaultDocument(), updatedAt: '2026-11-14T10:00:00Z' }, server = { ...defaultDocument(), updatedAt: '2026-11-14T11:00:00Z' };
  expect(pickWinner(local, server)).toEqual({ winner: server, loser: local });
  expect(pickWinner(local, local)).toEqual({ winner: local, loser: null });
  expect(documentBytes({ ...local, dashboards: [{ id: 'd', name: 'العربية', widgets: [] }] })).toBeGreaterThan(JSON.stringify({ ...local, dashboards: [{ id: 'd', name: 'العربية', widgets: [] }] }).length);
});
test('board writer has one request at a time and replays the latest dirty document only', async () => {
  const saved: string[] = [], resolvers: (() => void)[] = [];
  const writer = createBoardWriter(async doc => { saved.push(doc.activeId); await new Promise<void>(resolve => resolvers.push(resolve)); });
  const base = defaultDocument(), a = writer.save({ ...base, activeId: 'a' });
  const b = writer.save({ ...base, activeId: 'b' }), c = writer.save({ ...base, activeId: 'c' });
  expect(saved).toEqual(['a']); resolvers.shift()?.();
  await new Promise(resolve => setTimeout(resolve, 0)); expect(saved).toEqual(['a', 'c']); resolvers.shift()?.();
  await Promise.all([a, b, c]); expect(saved).toHaveLength(2);
});
test('oversized UTF-8 board bodies are rejected before sending and failed writes remain retryable', async () => {
  const base = defaultDocument();
  let calls = 0;
  const writer = createBoardWriter(async () => { if (++calls === 1) throw new Error('offline'); });
  const oversized = { ...base, dashboards: [{ id: 'd', name: 'لوحتي', widgets: [{ i: 'n', d: 'notes', w: 6, h: 3, c: { text: 'ع'.repeat(40000) } }] }] };
  await expect(writer.save(oversized)).rejects.toThrow('حجم اللوحة'); expect(calls).toBe(0);
  await expect(writer.save(base)).rejects.toThrow('offline'); await writer.save(base); expect(calls).toBe(2);
});
