import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BoardDocument } from './types';

export const BOARD_DOCUMENT_KEY = 'sz-board:v1';
export const BOARD_PREVIOUS_KEY = 'sz-board:v1:prev';

function accountKey(key: string, accountId: number | null): string {
  return accountId === null ? key : `${key}:account:${accountId}`;
}

export function boardDocumentKey(accountId: number | null = null): string {
  return accountKey(BOARD_DOCUMENT_KEY, accountId);
}

export function boardPreviousKey(accountId: number | null = null): string {
  return accountKey(BOARD_PREVIOUS_KEY, accountId);
}

async function readJson(key: string): Promise<unknown> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readBoardDocument(
  accountId: number | null = null,
): Promise<unknown> {
  return readJson(boardDocumentKey(accountId));
}

export function writeBoardDocument(
  document: BoardDocument,
  accountId: number | null = null,
): Promise<boolean> {
  return writeJson(boardDocumentKey(accountId), document);
}

// The website keeps one storage slot for guest and account, so signing in
// carries the guest board over. Native slots are account scoped, so the account
// slot falls back to the guest board exactly once: after the first write the
// account has its own document and a later sign-in reads that instead.
export async function readBoardDocumentForAccount(
  accountId: number | null,
): Promise<unknown> {
  const own = await readBoardDocument(accountId);
  if (own !== null || accountId === null) {
    return own;
  }
  return readBoardDocument(null);
}

export function readPreviousDocument(
  accountId: number | null = null,
): Promise<unknown> {
  return readJson(boardPreviousKey(accountId));
}

export function writePreviousDocument(
  document: BoardDocument,
  accountId: number | null = null,
): Promise<boolean> {
  return writeJson(boardPreviousKey(accountId), document);
}

export async function clearPreviousDocument(
  accountId: number | null = null,
): Promise<void> {
  try {
    await AsyncStorage.removeItem(boardPreviousKey(accountId));
  } catch {
    return;
  }
}

/*
PORT STATUS
  source:     resources/js/Pages/Board/_lib/storage.ts (74 lines)
  confidence: high
  todos:      0
  notes:      AsyncStorage preserves the current and recoverable Board documents with validated reads,
              plus a one-time guest-to-account fallback the shared web storage slot gets for free.
*/
