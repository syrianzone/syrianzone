import {
  boundSessionIsUsable,
  loadBoundSession,
  normalizeRoomCode,
  parseBoundSession,
  readStoredBoundSession,
  saveBoundSession,
  validRoomCode,
  type GuessWhoSessionStorage,
} from './session';
import type { GuessWhoBoundSession } from './types';

const session: GuessWhoBoundSession = {
  credential: 'c'.repeat(48),
  expires_at: '2026-07-16T13:00:00.000Z',
  generation: 2,
  role: 'player_1',
  room_code: 'room-1234',
  session_id: 'public-player-1',
};

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: GuessWhoSessionStorage = {
    clear: jest.fn(async () => {
      value = null;
    }),
    get: jest.fn(async () => value),
    set: jest.fn(async (next) => {
      value = next;
    }),
  };
  return { read: () => value, storage };
}

describe('Guess Who room credential storage', () => {
  test('round trips only complete server-issued bindings', async () => {
    const memory = memoryStorage();
    await saveBoundSession(session, memory.storage);

    expect(parseBoundSession(memory.read() ?? '')).toEqual(session);
    await expect(readStoredBoundSession(memory.storage)).resolves.toEqual(session);
    await expect(
      loadBoundSession(
        session.room_code,
        memory.storage,
        Date.parse('2026-07-16T12:00:00.000Z'),
      ),
    ).resolves.toEqual(session);
    expect(memory.read()).not.toContain('installation');
  });

  test('clears expired, malformed, and room-mismatched credentials', async () => {
    expect(
      boundSessionIsUsable(
        session,
        session.room_code,
        Date.parse('2026-07-16T12:59:40.000Z'),
      ),
    ).toBe(false);
    const expired = memoryStorage(JSON.stringify(session));
    await expect(
      loadBoundSession(
        session.room_code,
        expired.storage,
        Date.parse('2026-07-16T12:59:40.000Z'),
      ),
    ).resolves.toBeNull();
    expect(expired.storage.clear).toHaveBeenCalledTimes(1);

    const wrongRoom = memoryStorage(JSON.stringify(session));
    await expect(
      loadBoundSession(
        'room-9999',
        wrongRoom.storage,
        Date.parse('2026-07-16T12:00:00.000Z'),
      ),
    ).resolves.toBeNull();
    expect(parseBoundSession('{broken')).toBeNull();
  });

  test('trims deep-link room codes and rejects path injection', () => {
    expect(normalizeRoomCode('  room-1234  ')).toBe('room-1234');
    expect(validRoomCode('room-1234')).toBe(true);
    expect(validRoomCode('../admin')).toBe(false);
    expect(validRoomCode('abc')).toBe(false);
  });
});
