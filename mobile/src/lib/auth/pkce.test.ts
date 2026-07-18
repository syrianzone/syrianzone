import {
  createPkceTransaction,
  createS256Challenge,
  encodeBytesBase64Url,
  type PkceCrypto,
} from './pkce';

const canonicalVerifier =
  'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

test('encodes random bytes with the RFC 7636 URL-safe alphabet', () => {
  expect(encodeBytesBase64Url(new Uint8Array([251, 255, 239]))).toBe('-__v');
});

test('creates the canonical 43-character S256 challenge', async () => {
  const crypto: PkceCrypto = {
    digestBase64: jest.fn(async () =>
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM='
    ),
    getRandomBytes: jest.fn(),
  };

  await expect(createS256Challenge(canonicalVerifier, crypto)).resolves.toBe(
    'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
  );
  expect(crypto.digestBase64).toHaveBeenCalledWith(canonicalVerifier);
});

test('creates independent 256-bit verifier and state values', async () => {
  const crypto: PkceCrypto = {
    digestBase64: jest.fn(async () =>
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw+cM='
    ),
    getRandomBytes: jest
      .fn()
      .mockResolvedValueOnce(new Uint8Array(32).fill(0))
      .mockResolvedValueOnce(new Uint8Array(32).fill(255)),
  };

  const transaction = await createPkceTransaction(crypto);

  expect(transaction.verifier).toHaveLength(43);
  expect(transaction.state).toHaveLength(43);
  expect(transaction.challenge).toHaveLength(43);
  expect(transaction.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(transaction.state).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(transaction.state).not.toBe(transaction.verifier);
  expect(crypto.getRandomBytes).toHaveBeenNthCalledWith(1, 32);
  expect(crypto.getRandomBytes).toHaveBeenNthCalledWith(2, 32);
});
