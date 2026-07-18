import * as Crypto from 'expo-crypto';

let sessionId: string | null = null;

export function getGuessWhoSessionId(): string {
  sessionId ??= Crypto.randomUUID();
  return sessionId;
}

export function clearGuessWhoSessionId(): void {
  sessionId = null;
}

/*
PORT STATUS
  source:     resources/js/Lib/guessWhoSession.ts (49 lines)
  confidence: high
  todos:      0
  notes:      The legacy tab identity becomes a process nonce and is never used as a room credential or authorization token.
*/
