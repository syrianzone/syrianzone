import { expect, test } from 'bun:test';
import { createZoneResolver } from './zone-resolver';
test('authoritative point zones coalesce, persist and never guess from longitude', async () => {
  let lookups = 0; const stored = new Map<string, unknown>();
  const resolver = createZoneResolver({ read: async key => stored.get(key), write: async (key, value) => { stored.set(key, value); }, reverse: async () => { lookups++; return 'Europe/Amsterdam'; } });
  const point = { lat: 52.37, lon: 4.9 };
  expect(await Promise.all([resolver.resolve(point), resolver.resolve(point)])).toEqual(['Europe/Amsterdam', 'Europe/Amsterdam']); expect(lookups).toBe(1);
  expect(resolver.peek(point)).toBe('Europe/Amsterdam');
  const unavailable = createZoneResolver({ read: async () => null, write: async () => {}, reverse: async () => 'UTC+5-from-longitude' });
  await expect(unavailable.resolve({ lat: 0, lon: 75 })).rejects.toThrow();
});
