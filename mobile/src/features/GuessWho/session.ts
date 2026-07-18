import { roomSessionStorage } from '@/lib/storage/secure';

import type { GuessWhoBoundSession } from './types';

export interface GuessWhoSessionStorage {
  clear: () => Promise<void>;
  get: () => Promise<string | null>;
  set: (value: string) => Promise<void>;
}

function isPlayerRole(value: unknown): boolean {
  return value === 'player_1' || value === 'player_2';
}

export function parseBoundSession(value: string): GuessWhoBoundSession | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('credential' in parsed) ||
      typeof parsed.credential !== 'string' ||
      parsed.credential.length < 32 ||
      !('expires_at' in parsed) ||
      typeof parsed.expires_at !== 'string' ||
      !('session_id' in parsed) ||
      typeof parsed.session_id !== 'string' ||
      !('room_code' in parsed) ||
      typeof parsed.room_code !== 'string' ||
      !('role' in parsed) ||
      !isPlayerRole(parsed.role) ||
      !('generation' in parsed) ||
      typeof parsed.generation !== 'number' ||
      !Number.isInteger(parsed.generation) ||
      parsed.generation < 0
    ) {
      return null;
    }
    return parsed as GuessWhoBoundSession;
  } catch {
    return null;
  }
}

export function boundSessionIsUsable(
  session: GuessWhoBoundSession,
  roomCode: string,
  now = Date.now(),
): boolean {
  const expiry = Date.parse(session.expires_at);
  return (
    session.room_code === roomCode &&
    Number.isFinite(expiry) &&
    expiry > now + 30_000
  );
}

export async function loadBoundSession(
  roomCode: string,
  storage: GuessWhoSessionStorage = roomSessionStorage,
  now = Date.now(),
): Promise<GuessWhoBoundSession | null> {
  const raw = await storage.get();
  if (!raw) {
    return null;
  }
  const session = parseBoundSession(raw);
  if (!session || !boundSessionIsUsable(session, roomCode, now)) {
    await storage.clear();
    return null;
  }
  return session;
}

export async function readStoredBoundSession(
  storage: GuessWhoSessionStorage = roomSessionStorage,
): Promise<GuessWhoBoundSession | null> {
  const raw = await storage.get();
  return raw ? parseBoundSession(raw) : null;
}

export async function saveBoundSession(
  session: GuessWhoBoundSession,
  storage: GuessWhoSessionStorage = roomSessionStorage,
): Promise<void> {
  await storage.set(JSON.stringify(session));
}

export function normalizeRoomCode(value: string): string {
  return value.trim();
}

export function validRoomCode(value: string): boolean {
  return /^[A-Za-z0-9-]{4,64}$/.test(normalizeRoomCode(value));
}
