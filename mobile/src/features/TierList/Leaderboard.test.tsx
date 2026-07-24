import { render } from '@testing-library/react-native';

import TierListLeaderboard from './Leaderboard';

jest.mock('@/features/Polls/Leaderboard', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text, View } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return {
    __esModule: true,
    default: ({
      ChartComponent,
      identifier,
    }: {
      ChartComponent?: React.ComponentType;
      identifier: string;
    }) => (
      <View>
        <Text>{identifier}</Text>
        {ChartComponent ? React.createElement(ChartComponent) : null}
      </View>
    ),
  };
});

jest.mock('./TimeseriesChart', () => {
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return {
    TimeseriesChart: jest.fn(() => <Text>tier chart</Text>),
  };
});

test('binds the government leaderboard to its Tier List chart wrapper', async () => {
  const view = await render(<TierListLeaderboard />);

  expect(view.getByText('best-ministers')).toBeTruthy();
  expect(view.getByText('tier chart')).toBeTruthy();
});
