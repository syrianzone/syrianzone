import * as Crypto from 'expo-crypto';
import { Base64 } from 'js-base64';

const randomByteCount = 32;
const pkcePattern = /^[A-Za-z0-9_-]{43}$/;

export interface PkceCrypto {
  digestBase64: (value: string) => Promise<string>;
  getRandomBytes: (byteCount: number) => Promise<Uint8Array>;
}

export interface PkceTransaction {
  challenge: string;
  state: string;
  verifier: string;
}

const expoPkceCrypto: PkceCrypto = {
  digestBase64: (value) =>
    Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  getRandomBytes: Crypto.getRandomBytesAsync,
};

function normalizeBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function encodeBytesBase64Url(bytes: Uint8Array): string {
  return normalizeBase64Url(Base64.fromUint8Array(bytes));
}

export async function createS256Challenge(
  verifier: string,
  crypto: PkceCrypto = expoPkceCrypto,
): Promise<string> {
  const challenge = normalizeBase64Url(await crypto.digestBase64(verifier));
  if (!pkcePattern.test(challenge)) {
    throw new Error('Invalid S256 challenge');
  }
  return challenge;
}

export async function createPkceTransaction(
  crypto: PkceCrypto = expoPkceCrypto,
): Promise<PkceTransaction> {
  const [verifierBytes, stateBytes] = await Promise.all([
    crypto.getRandomBytes(randomByteCount),
    crypto.getRandomBytes(randomByteCount),
  ]);
  const verifier = encodeBytesBase64Url(verifierBytes);
  const state = encodeBytesBase64Url(stateBytes);
  if (!pkcePattern.test(verifier) || !pkcePattern.test(state)) {
    throw new Error('Invalid PKCE entropy');
  }

  return {
    challenge: await createS256Challenge(verifier, crypto),
    state,
    verifier,
  };
}
