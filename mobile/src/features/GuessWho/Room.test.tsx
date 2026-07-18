import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import type { GuessWhoGameState } from './model';
import GameRoom from './Room';
import type { GuessWhoBoundSession, GuessWhoRoomSnapshot } from './types';
import type { GuessWhoRoomController } from './useGuessWhoRoom';

const characters = Array.from({ length: 12 }, (_, index) => ({
  eliminated: false,
  id: index + 1,
  image_path: `guesswho/${index + 1}.jpg`,
  name_ar: `الشخصية ${index + 1}`,
}));

const entry: GuessWhoBoundSession = {
  credential: 'opaque-secret-credential-value-1234567890',
  expires_at: '2026-07-16T14:00:00.000Z',
  generation: 2,
  role: 'player_1',
  room_code: 'room-1234',
  session_id: 'public-session-1',
};

const snapshot: GuessWhoRoomSnapshot = {
  category: { characters, name_ar: 'شخصيات سورية' },
  generation: 2,
  role: 'player_1',
  room_code: entry.room_code,
  status: 'lobby',
};

const lobby: GuessWhoGameState = {
  board: characters,
  my_secret_id: null,
  my_turn: true,
  notice: null,
  opponent_remaining: 12,
  peer_connected: false,
  peer_ready: false,
  phase: 'lobby',
  role: 'player_1',
  terminal_message: null,
};

let mockController: GuessWhoRoomController;

jest.mock('./useGuessWhoRoom', () => ({
  useGuessWhoRoom: () => mockController,
}));

function controller(game: GuessWhoGameState): GuessWhoRoomController {
  return {
    chooseSecret: jest.fn(),
    dismissNotice: jest.fn(),
    game,
    guess: jest.fn(),
    loading: false,
    opponentName: 'الصديق',
    passTurn: jest.fn(),
    reconnect: jest.fn(),
    retry: jest.fn(),
    roomError: null,
    snapshot,
    toggleElimination: jest.fn(),
    transportStatus: 'connected',
  };
}

async function renderRoom(
  onRestart = jest.fn(),
) {
  return render(
    <LocaleProvider>
      <AppThemeProvider>
        <GameRoom entry={entry} onExit={jest.fn()} onRestart={onRestart} />
      </AppThemeProvider>
    </LocaleProvider>,
  );
}

describe('Guess Who native room', () => {
  test('confirms a private character selection from the lobby grid', async () => {
    mockController = controller(lobby);
    const view = await renderRoom();

    await fireEvent.press(view.getAllByText('اختيار الشخصية')[0]!);
    await waitFor(() =>
      expect(
        view.getByText('هل تريد اختيار هذه كشخصيتك السرية؟'),
      ).toBeTruthy(),
    );
    await fireEvent.press(view.getByText('نعم'));

    expect(mockController.chooseSecret).toHaveBeenCalledWith(1);
  });

  test('renders the terminal result and restarts the same room', async () => {
    const onRestart = jest.fn();
    mockController = controller({
      ...lobby,
      phase: 'ended',
      terminal_message: 'مبروك! لقد فزت باللعبة.',
    });
    const view = await renderRoom(onRestart);

    expect(view.getByText('مبروك! لقد فزت باللعبة.')).toBeTruthy();
    await fireEvent.press(view.getByText('العب مجدداً'));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
