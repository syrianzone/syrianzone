import { api as client } from '@/Lib/api';

/**
 * Guess Who's room endpoints (web routes, not `/api`): the lobby creates a
 * room, the room page joins, sends actions and reads the authoritative state.
 */

/** The authoritative snapshot the server returns when a player rejoins. */
interface GuessWhoState {
  myCharacterId?: number | null;
  myEliminated?: number[];
  opponentRemaining?: number;
  status?: string;
  turn?: string;
  winner?: string;
}

export const guessWhoApi = {
  createRoom(categoryId: number | 'random', playerSession: string | null): Promise<{ room_code: string }> {
    return client.post('/guesswho/rooms', { category_id: categoryId, player_session: playerSession });
  },

  join(roomCode: string, playerSession: string): Promise<unknown> {
    return client.post(`/guesswho/room/${roomCode}/join`, { player_session: playerSession });
  },

  sendAction(roomCode: string, senderSession: string, action: string, payload: Record<string, unknown>): Promise<unknown> {
    return client.post(`/guesswho/room/${roomCode}/action`, {
      sender_session: senderSession,
      action,
      payload,
    });
  },

  state(roomCode: string, senderSession: string): Promise<GuessWhoState> {
    return client.get(`/guesswho/room/${roomCode}/state`, { params: { sender_session: senderSession } });
  },
};
