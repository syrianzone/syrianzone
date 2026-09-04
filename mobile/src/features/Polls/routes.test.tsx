import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import PollRoute from '@/app/polls/[slug]/index';
import PollLeaderboardRoute from '@/app/polls/[slug]/leaderboard';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), canGoBack: jest.fn(() => true), push: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => ({ slug: 'best-ministers' }),
}));

jest.mock('@/features/Polls/Show', () => {
  const { Pressable, Text, View } = jest.requireActual<
    typeof import('react-native')
  >('react-native');
  return {
    __esModule: true,
    default: ({
      identifier,
      onBack,
      onLeaderboard,
    }: {
      identifier: string;
      onBack: () => void;
      onLeaderboard: () => void;
    }) => (
      <View>
        <Text>show:{identifier}</Text>
        <Pressable onPress={onLeaderboard}><Text>results</Text></Pressable>
        <Pressable onPress={onBack}><Text>back</Text></Pressable>
      </View>
    ),
  };
});

jest.mock('@/features/Polls/Leaderboard', () => {
  const { Pressable, Text, View } = jest.requireActual<
    typeof import('react-native')
  >('react-native');
  return {
    __esModule: true,
    default: ({
      identifier,
      onVote,
    }: {
      identifier: string;
      onVote: () => void;
    }) => (
      <View>
        <Text>leaderboard:{identifier}</Text>
        <Pressable onPress={onVote}><Text>vote</Text></Pressable>
      </View>
    ),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(router.canGoBack).mockReturnValue(true);
});

test('renders the poll route for its slug param and pushes the leaderboard route', async () => {
  const view = await render(<PollRoute />);

  expect(view.getByText('show:best-ministers')).toBeTruthy();
  await fireEvent.press(view.getByText('results'));

  expect(router.push).toHaveBeenCalledWith({
    params: { slug: 'best-ministers' },
    pathname: '/polls/[slug]/leaderboard',
  });
});

test('renders the leaderboard route for its slug param and pops back to the poll', async () => {
  const view = await render(<PollLeaderboardRoute />);

  expect(view.getByText('leaderboard:best-ministers')).toBeTruthy();
  await fireEvent.press(view.getByText('vote'));

  expect(router.back).toHaveBeenCalledTimes(1);
});

test('falls back to the polls index when a deep link left no history to pop', async () => {
  jest.mocked(router.canGoBack).mockReturnValue(false);
  const view = await render(<PollRoute />);

  await fireEvent.press(view.getByText('back'));

  expect(router.back).not.toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith({
    params: { slug: 'polls' },
    pathname: '/feature/[slug]',
  });
});
