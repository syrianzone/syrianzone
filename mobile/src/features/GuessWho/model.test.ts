import {
  chooseSecret,
  createGameState,
  negotiationAttemptTimes,
  parseGameMessage,
  passTurn,
  peerOpened,
  receivePeerMessage,
  requestGuess,
  selectReadyMessage,
  shuffleCharacters,
  stateSyncMessage,
  toggleElimination,
} from './model';
import type { GuessWhoCharacter, GuessWhoRoomSnapshot } from './types';

const characters: GuessWhoCharacter[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  image_path: `guesswho/character-${index + 1}.jpg`,
  name_ar: `الشخصية ${index + 1}`,
}));

const snapshot: GuessWhoRoomSnapshot = {
  category: { characters, name_ar: 'شخصيات سورية' },
  generation: 3,
  role: 'player_1',
  room_code: 'room-1234',
  status: 'lobby',
};

function playingState() {
  let state = createGameState(snapshot, () => 0.5);
  state = chooseSecret(state, 4);
  state = peerOpened(state);
  return receivePeerMessage(state, selectReadyMessage(), 'الصديق').state;
}

describe('Guess Who source characterization', () => {
  test('shuffles a shared character set without adding or losing cards', () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3, 0.5, 0.7, 0.9, 0];
    let sample = 0;
    const board = shuffleCharacters(characters, () => samples[sample++] ?? 0);

    expect(board.map((character) => character.id)).toEqual([
      9, 8, 4, 10, 11, 2, 12, 7, 6, 5, 3, 1,
    ]);
    expect(board.every((character) => !character.eliminated)).toBe(true);
  });

  test('waits for both secret selections and the data channel before play', () => {
    let state = createGameState(snapshot, () => 0);
    state = chooseSecret(state, 4);
    expect(state.phase).toBe('selecting');
    state = peerOpened(state);
    expect(state.phase).toBe('selecting');
    state = receivePeerMessage(state, selectReadyMessage(), 'الصديق').state;

    expect(state.phase).toBe('playing');
    expect(state.my_turn).toBe(true);
    expect(selectReadyMessage()).toEqual({ action: 'select_ready', payload: {} });
    expect(JSON.stringify(selectReadyMessage())).not.toContain('4');
  });

  test('syncs eliminations and reconnect state without exposing the secret', () => {
    const state = playingState();
    const eliminated = toggleElimination(state, 2);

    expect(eliminated.state.board.find((item) => item.id === 2)?.eliminated).toBe(true);
    expect(eliminated.outbound).toEqual({
      action: 'elimination_update',
      payload: { remaining: 11 },
    });
    const sync = stateSyncMessage(eliminated.state);
    expect(sync).toEqual({
      action: 'state_sync',
      payload: { ready: true, remaining: 11, turn_role: 'player_1' },
    });
    expect(JSON.stringify(sync)).not.toContain('my_secret');
  });

  test('uses the server player role to reconcile turns after reconnect', () => {
    const playerTwoSnapshot = { ...snapshot, role: 'player_2' as const };
    let state = createGameState(playerTwoSnapshot, () => 0);
    state = chooseSecret(state, 3);
    state = peerOpened(state);
    state = receivePeerMessage(
      state,
      {
        action: 'state_sync',
        payload: { ready: true, remaining: 9, turn_role: 'player_1' },
      },
      'الصديق',
    ).state;
    expect(state.phase).toBe('playing');
    expect(state.my_turn).toBe(false);
    expect(state.opponent_remaining).toBe(9);

    state = receivePeerMessage(
      state,
      {
        action: 'state_sync',
        payload: { ready: true, remaining: 9, turn_role: 'player_2' },
      },
      'الصديق',
    ).state;
    expect(state.my_turn).toBe(true);
  });

  test('moves turns after wrong guesses and ends on a correct guess', () => {
    const state = playingState();
    const localGuess = requestGuess(state, 5);
    expect(localGuess.outbound).toEqual({
      action: 'guess',
      payload: { character_id: 5 },
    });

    const wrong = receivePeerMessage(
      state,
      { action: 'guess', payload: { character_id: 5 } },
      'الصديق',
    );
    expect(wrong.state.my_turn).toBe(true);
    expect(wrong.outbound).toEqual({
      action: 'guess_result',
      payload: { success: false },
    });

    const correct = receivePeerMessage(
      state,
      { action: 'guess', payload: { character_id: 4 } },
      'الصديق',
    );
    expect(correct.state.phase).toBe('ended');
    expect(correct.state.terminal_message).toContain('لقد فاز الصديق');
    expect(correct.outbound).toEqual({
      action: 'guess_result',
      payload: { success: true },
    });
  });

  test('accepts pass turn and both terminal result states', () => {
    const state = playingState();
    const passed = passTurn(state);
    expect(passed.state.my_turn).toBe(false);
    expect(passed.outbound).toEqual({ action: 'pass_turn', payload: {} });
    expect(
      receivePeerMessage(
        passed.state,
        { action: 'pass_turn', payload: {} },
        'الصديق',
      ).state.my_turn,
    ).toBe(true);
    expect(
      receivePeerMessage(
        state,
        { action: 'guess_result', payload: { success: true } },
        'الصديق',
      ).state.phase,
    ).toBe('ended');
    expect(
      receivePeerMessage(
        state,
        { action: 'guess_result', payload: { success: false } },
        'الصديق',
      ).state.my_turn,
    ).toBe(false);
  });

  test('rejects malformed peer input and out-of-range remaining counts', () => {
    const state = playingState();
    expect(parseGameMessage('{not-json')).toBeNull();
    expect(parseGameMessage({ action: 'guess', payload: { character_id: '4' } })).toBeNull();
    const next = receivePeerMessage(
      state,
      { action: 'elimination_update', payload: { remaining: 99 } },
      'الصديق',
    ).state;
    expect(next).toBe(state);

    const lobby = createGameState(snapshot, () => 0);
    expect(
      receivePeerMessage(
        lobby,
        { action: 'pass_turn', payload: {} },
        'الصديق',
      ).state,
    ).toBe(lobby);
  });

  test('retries negotiation after one, two, and four second waits', () => {
    expect(negotiationAttemptTimes()).toEqual([1_000, 3_000, 7_000]);
  });
});
