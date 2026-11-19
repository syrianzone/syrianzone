import { expect, test } from 'bun:test';
import { endSession } from './end-session';

test('clears a revoked token locally even when logout returns401', async () => {
  const actions: string[] = [];
  await endSession({ revoke: async () => { throw { status: 401 }; }, alreadyRevoked: error => (error as { status?: number }).status === 401,
    clearLocal: async () => { actions.push('credential-transaction'); } });
  expect(actions).toEqual(['credential-transaction']);
});
test('keeps account state retryable when revocation or Keychain deletion fails', async () => {
  let cleared = false;
  await expect(endSession({ revoke: async () => { throw new Error('offline'); }, alreadyRevoked: () => false, clearLocal: async () => { cleared = true; } })).rejects.toThrow('offline');
  await expect(endSession({ revoke: async () => undefined, alreadyRevoked: () => false, clearLocal: async () => { throw new Error('locked'); } })).rejects.toThrow('locked');
  expect(cleared).toBe(false);
});
