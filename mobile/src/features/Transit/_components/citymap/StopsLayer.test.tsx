import { fireEvent, render } from '@testing-library/react-native';

import { useMapStore } from '../../_store/useMapStore';
import type { StopCollection } from '../../_types';
import { StopsLayer } from './StopsLayer';

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GeoJSONSource: ({
      children,
      hitbox,
      id,
      onPress,
    }: {
      children: React.ReactNode;
      hitbox?: object;
      id: string;
      onPress?: (event: unknown) => void;
    }) => React.createElement(View, { testID: id, ...({ hitbox, onPress } as object) }, children),
    Layer: ({ filter, id }: { filter?: unknown; id: string }) =>
      React.createElement(View, { testID: id, ...({ filter } as object) }),
  };
});

const stops: StopCollection = {
  features: [
    {
      geometry: { coordinates: [36.2, 33.4], type: 'Point' },
      properties: { id: 'stop-7', nameAr: 'الحلبوني', routeIds: ['route-b'] },
      type: 'Feature',
    },
  ],
  type: 'FeatureCollection',
};

beforeEach(() => {
  useMapStore.setState({ hoveredStopId: null, selectedRouteId: null });
});

test('selects a pressed stop and drops any route selection', async () => {
  useMapStore.setState({ selectedRouteId: 'route-b' });
  const view = await render(<StopsLayer interactive stops={stops} />);
  const stopPropagation = jest.fn();

  await fireEvent(view.getByTestId('transit-stops-source'), 'press', {
    nativeEvent: { features: [{ properties: { id: 'stop-7' } }] },
    stopPropagation,
  });

  expect(stopPropagation).toHaveBeenCalled();
  expect(useMapStore.getState().hoveredStopId).toBe('stop-7');
  expect(useMapStore.getState().selectedRouteId).toBeNull();
});

test('highlights the selected stop with its own circle layer', async () => {
  useMapStore.setState({ hoveredStopId: 'stop-7' });

  const view = await render(<StopsLayer interactive stops={stops} />);

  expect(view.getByTestId('transit-stop-selected').props.filter).toEqual([
    '==',
    ['get', 'id'],
    'stop-7',
  ]);
});

test('leaves stop presses off maps that are not interactive', async () => {
  const view = await render(<StopsLayer stops={stops} />);

  expect(view.getByTestId('transit-stops-source').props.onPress).toBeUndefined();
});
