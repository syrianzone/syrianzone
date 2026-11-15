import { expect, test } from 'bun:test';
import { addListening, acknowledge, decodeUsage, emptyUsage, pendingBatch } from './usage-model';
test('native listening ledger hydrates, isolates users and subtracts only the acknowledged batch', () => {
  let ledger = addListening(emptyUsage(), 2.4, 10);
  const batch = pendingBatch(ledger, 10)!;
  expect(batch).toEqual({ seconds: 2, bytes: 32000 });
  ledger = addListening(ledger, 3, 10);
  ledger = addListening(ledger, 1, 20);
  ledger = acknowledge(ledger, 10, batch.seconds);
  expect(ledger.pending['10']).toBeCloseTo(3.4);
  expect(ledger.pending['20']).toBe(1);
  expect(decodeUsage(JSON.parse(JSON.stringify(ledger)))).toEqual(ledger);
  expect(addListening(ledger, 0, 10)).toBe(ledger);
  expect(addListening(ledger, Number.NaN, 10)).toBe(ledger);
  expect(pendingBatch(addListening(ledger, 100000, 10), 10)?.seconds).toBe(86400);
});
