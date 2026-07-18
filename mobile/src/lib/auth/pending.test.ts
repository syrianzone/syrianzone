import { createPendingAuthStore } from './pending';

const transaction = {
  createdAt: 1_000_000,
  deviceName: 'syrianzone-ios',
  redirectUri: 'syrianzone://auth/callback',
  state: 's'.repeat(43),
  verifier: 'v'.repeat(43),
};

describe('pending mobile auth storage', () => {
  test('round trips a bounded PKCE transaction', async () => {
    let value: string | null = null;
    const store = createPendingAuthStore({
      clear: jest.fn(async () => {
        value = null;
      }),
      get: jest.fn(async () => value),
      set: jest.fn(async (next) => {
        value = next;
      }),
    });

    await store.save(transaction);
    await expect(store.load(1_000_001)).resolves.toEqual(transaction);
  });

  test('clears expired and malformed records', async () => {
    let value: string | null = JSON.stringify(transaction);
    const clear = jest.fn(async () => {
      value = null;
    });
    const store = createPendingAuthStore({
      clear,
      get: jest.fn(async () => value),
      set: jest.fn(async (next) => {
        value = next;
      }),
    });

    await expect(store.load(1_000_000 + 16 * 60_000)).resolves.toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);

    value = '{invalid';
    await expect(store.load(1_000_000)).resolves.toBeNull();
    expect(clear).toHaveBeenCalledTimes(2);
  });
});
