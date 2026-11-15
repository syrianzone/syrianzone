import { expect, test } from 'bun:test';
import { createInstallationId } from './device-model';

test('coalesces concurrent guest identities into one persistent random installation identifier', async () => {
  let value: string | null = null, writes = 0;
  const get = createInstallationId({ read: async () => value, write: async next => { writes++; value = next; }, random: () => 'b95ccaa4-1020-4000-a001-123456789abc' });
  const identities = await Promise.all([get(), get(), get()]);
  expect(new Set(identities).size).toBe(1); expect(writes).toBe(1);
  expect(await get()).toBe(identities[0]);
});
test('leaves malformed stored identity untouched and surfaces the failure', async () => {
  const get = createInstallationId({ read: async () => 'corrupt', write: async () => { throw new Error('should not overwrite'); }, random: () => '' });
  await expect(get()).rejects.toThrow('المعرّف');
});
