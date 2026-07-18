import type {
  GuessWhoCharacter,
  GuessWhoPlayerRole,
  GuessWhoRoomSnapshot,
} from './types';

export type GuessWhoGamePhase = 'ended' | 'lobby' | 'playing' | 'selecting';

export interface GuessWhoBoardCharacter extends GuessWhoCharacter {
  eliminated: boolean;
}

export interface GuessWhoGameState {
  board: readonly GuessWhoBoardCharacter[];
  my_secret_id: number | null;
  my_turn: boolean;
  notice: string | null;
  opponent_remaining: number;
  peer_connected: boolean;
  peer_ready: boolean;
  phase: GuessWhoGamePhase;
  role: GuessWhoPlayerRole;
  terminal_message: string | null;
}

export type GuessWhoGameMessage =
  | { action: 'elimination_update'; payload: { remaining: number } }
  | { action: 'guess'; payload: { character_id: number } }
  | { action: 'guess_result'; payload: { success: boolean } }
  | { action: 'pass_turn'; payload: Record<string, never> }
  | { action: 'select_ready'; payload: Record<string, never> }
  | {
      action: 'state_sync';
      payload: {
        ready: boolean;
        remaining: number;
        turn_role: GuessWhoPlayerRole;
      };
    };

export interface GuessWhoPeerResult {
  notice?: string;
  outbound?: GuessWhoGameMessage;
  state: GuessWhoGameState;
}

export const negotiationRetryDelays = [1_000, 2_000, 4_000] as const;

export function negotiationAttemptTimes(
  delays: readonly number[] = negotiationRetryDelays,
): number[] {
  let elapsed = 0;
  return delays.map((delay) => {
    elapsed += delay;
    return elapsed;
  });
}

export function shuffleCharacters(
  characters: readonly GuessWhoCharacter[],
  random: () => number = Math.random,
): GuessWhoBoardCharacter[] {
  const board = characters.map((character) => ({
    ...character,
    eliminated: false,
  }));
  for (let index = board.length - 1; index > 0; index -= 1) {
    const sample = random();
    const bounded = Number.isFinite(sample)
      ? Math.min(Math.max(sample, 0), 0.999999999999)
      : 0;
    const swapIndex = Math.floor(bounded * (index + 1));
    const current = board[index];
    const target = board[swapIndex];
    if (current && target) {
      board[index] = target;
      board[swapIndex] = current;
    }
  }
  return board;
}

export function createGameState(
  snapshot: GuessWhoRoomSnapshot,
  random: () => number = Math.random,
): GuessWhoGameState {
  return {
    board: shuffleCharacters(snapshot.category.characters, random),
    my_secret_id: null,
    my_turn: snapshot.role === 'player_1',
    notice: null,
    opponent_remaining: snapshot.category.characters.length,
    peer_connected: false,
    peer_ready: false,
    phase: snapshot.status === 'ended' ? 'ended' : 'lobby',
    role: snapshot.role,
    terminal_message:
      snapshot.status === 'ended' ? 'انتهت هذه الغرفة.' : null,
  };
}

function shouldPlay(state: GuessWhoGameState): boolean {
  return (
    state.my_secret_id !== null && state.peer_connected && state.peer_ready
  );
}

export function chooseSecret(
  state: GuessWhoGameState,
  characterId: number,
): GuessWhoGameState {
  if (
    state.phase === 'ended' ||
    !state.board.some((character) => character.id === characterId)
  ) {
    return state;
  }
  const selected = { ...state, my_secret_id: characterId, notice: null };
  return {
    ...selected,
    phase: shouldPlay(selected) ? 'playing' : 'selecting',
  };
}

export function peerOpened(state: GuessWhoGameState): GuessWhoGameState {
  if (state.phase === 'ended') {
    return state;
  }
  const connected = { ...state, peer_connected: true, notice: null };
  return {
    ...connected,
    phase: shouldPlay(connected) ? 'playing' : connected.phase,
  };
}

export function peerClosed(state: GuessWhoGameState): GuessWhoGameState {
  if (state.phase === 'ended') {
    return state;
  }
  return { ...state, peer_connected: false };
}

export function toggleElimination(
  state: GuessWhoGameState,
  characterId: number,
): GuessWhoPeerResult {
  if (state.phase !== 'playing') {
    return { state };
  }
  const board = state.board.map((character) =>
    character.id === characterId
      ? { ...character, eliminated: !character.eliminated }
      : character,
  );
  const remaining = board.filter((character) => !character.eliminated).length;
  return {
    outbound: {
      action: 'elimination_update',
      payload: { remaining },
    },
    state: { ...state, board },
  };
}

export function selectReadyMessage(): GuessWhoGameMessage {
  return { action: 'select_ready', payload: {} };
}

export function stateSyncMessage(
  state: GuessWhoGameState,
): GuessWhoGameMessage {
  const otherRole = state.role === 'player_1' ? 'player_2' : 'player_1';
  return {
    action: 'state_sync',
    payload: {
      ready: state.my_secret_id !== null,
      remaining: state.board.filter((character) => !character.eliminated).length,
      turn_role: state.my_turn ? state.role : otherRole,
    },
  };
}

export function requestGuess(
  state: GuessWhoGameState,
  characterId: number,
): GuessWhoPeerResult {
  const candidate = state.board.find(
    (character) => character.id === characterId,
  );
  if (
    state.phase !== 'playing' ||
    !state.my_turn ||
    candidate?.eliminated !== false
  ) {
    return {
      notice: 'ليس دورك حالياً لتخمين الشخصية.',
      state: { ...state, notice: 'ليس دورك حالياً لتخمين الشخصية.' },
    };
  }
  return {
    outbound: { action: 'guess', payload: { character_id: characterId } },
    state: { ...state, notice: null },
  };
}

export function passTurn(state: GuessWhoGameState): GuessWhoPeerResult {
  if (state.phase !== 'playing' || !state.my_turn) {
    return { state };
  }
  return {
    outbound: { action: 'pass_turn', payload: {} },
    state: { ...state, my_turn: false, notice: null },
  };
}

function validRemaining(value: unknown, maximum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

export function parseGameMessage(value: unknown): GuessWhoGameMessage | null {
  if (!value || typeof value !== 'object' || !('action' in value)) {
    return null;
  }
  const action = value.action;
  const payload = 'payload' in value ? value.payload : null;
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  if (action === 'select_ready' || action === 'pass_turn') {
    return { action, payload: {} };
  }
  if (
    action === 'elimination_update' &&
    'remaining' in payload &&
    typeof payload.remaining === 'number' &&
    Number.isInteger(payload.remaining)
  ) {
    return { action, payload: { remaining: payload.remaining } };
  }
  if (
    action === 'guess' &&
    'character_id' in payload &&
    typeof payload.character_id === 'number' &&
    Number.isInteger(payload.character_id) &&
    payload.character_id > 0
  ) {
    return { action, payload: { character_id: payload.character_id } };
  }
  if (
    action === 'guess_result' &&
    'success' in payload &&
    typeof payload.success === 'boolean'
  ) {
    return { action, payload: { success: payload.success } };
  }
  if (
    action === 'state_sync' &&
    'ready' in payload &&
    typeof payload.ready === 'boolean' &&
    'remaining' in payload &&
    typeof payload.remaining === 'number' &&
    Number.isInteger(payload.remaining) &&
    'turn_role' in payload &&
    (payload.turn_role === 'player_1' || payload.turn_role === 'player_2')
  ) {
    return {
      action,
      payload: {
        ready: payload.ready,
        remaining: payload.remaining,
        turn_role: payload.turn_role,
      },
    };
  }
  return null;
}

export function receivePeerMessage(
  state: GuessWhoGameState,
  message: GuessWhoGameMessage,
  opponentName: string,
): GuessWhoPeerResult {
  if (state.phase === 'ended') {
    return { state };
  }
  if (
    state.phase !== 'playing' &&
    message.action !== 'select_ready' &&
    message.action !== 'state_sync'
  ) {
    return { state };
  }
  const maximum = state.board.length;
  switch (message.action) {
    case 'select_ready': {
      const ready = { ...state, peer_ready: true };
      return {
        state: { ...ready, phase: shouldPlay(ready) ? 'playing' : ready.phase },
      };
    }
    case 'state_sync': {
      if (!validRemaining(message.payload.remaining, maximum)) {
        return { state };
      }
      const synced = {
        ...state,
        my_turn: message.payload.turn_role === state.role,
        opponent_remaining: message.payload.remaining,
        peer_ready: message.payload.ready,
      };
      return {
        state: {
          ...synced,
          phase: shouldPlay(synced) ? 'playing' : synced.phase,
        },
      };
    }
    case 'elimination_update':
      return validRemaining(message.payload.remaining, maximum)
        ? {
            state: {
              ...state,
              opponent_remaining: message.payload.remaining,
            },
          }
        : { state };
    case 'guess': {
      const guessed = state.board.find(
        (character) => character.id === message.payload.character_id,
      );
      const secret = state.board.find(
        (character) => character.id === state.my_secret_id,
      );
      if (!guessed || state.my_secret_id === null) {
        return { state };
      }
      if (guessed.id === state.my_secret_id) {
        return {
          outbound: { action: 'guess_result', payload: { success: true } },
          state: {
            ...state,
            my_turn: false,
            phase: 'ended',
            terminal_message: `لقد فاز ${opponentName}! خمن بنجاح أن شخصيتك هي: ${secret?.name_ar ?? ''}`,
          },
        };
      }
      return {
        notice: 'خمن الخصم بشكل خاطئ. دورك الآن.',
        outbound: { action: 'guess_result', payload: { success: false } },
        state: {
          ...state,
          my_turn: true,
          notice: 'خمن الخصم بشكل خاطئ. دورك الآن.',
        },
      };
    }
    case 'guess_result':
      return message.payload.success
        ? {
            state: {
              ...state,
              my_turn: false,
              phase: 'ended',
              terminal_message:
                'مبروك! لقد فزت باللعبة بتخمين شخصية الخصم بنجاح!',
            },
          }
        : {
            notice: 'تخمينك كان خاطئاً. انتهى دورك.',
            state: {
              ...state,
              my_turn: false,
              notice: 'تخمينك كان خاطئاً. انتهى دورك.',
            },
          };
    case 'pass_turn':
      return { state: { ...state, my_turn: true, notice: null } };
  }
}
