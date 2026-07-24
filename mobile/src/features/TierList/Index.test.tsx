import { fireEvent, render } from '@testing-library/react-native';

import TierListIndex from './Index';

jest.mock('@/features/Polls/Leaderboard', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return {
    __esModule: true,
    default: () => <Text>generic leaderboard</Text>,
  };
});

jest.mock('@/features/Polls/Show', () => {
  const { Pressable, Text } = jest.requireActual<
    typeof import('react-native')
  >('react-native');
  return {
    __esModule: true,
    default: ({ onLeaderboard }: { onLeaderboard: () => void }) => (
      <Pressable onPress={onLeaderboard}>
        <Text>show results</Text>
      </Pressable>
    ),
  };
});

jest.mock('./Leaderboard', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return {
    __esModule: true,
    default: () => <Text>tier list leaderboard</Text>,
  };
});

test('opens the Tier List leaderboard wrapper from the government poll', async () => {
  const view = await render(<TierListIndex />);

  await fireEvent.press(view.getByText('show results'));

  expect(view.getByText('tier list leaderboard')).toBeTruthy();
  expect(view.queryByText('generic leaderboard')).toBeNull();
});
