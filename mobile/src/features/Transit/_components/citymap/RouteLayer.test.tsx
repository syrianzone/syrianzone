import { fireEvent, render } from '@testing-library/react-native';

import { routeColors } from '../../_lib/mapColors';
import { useMapStore } from '../../_store/useMapStore';
import type { RouteCollection } from '../../_types';
import { RouteLayer } from './RouteLayer';

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
    Layer: ({ id, paint }: { id: string; paint: object }) =>
      React.createElement(View, { testID: id, ...({ paint } as object) }),
  };
});

const routes: RouteCollection = {
  features: [
    {
      geometry: { coordinates: [[36.2, 33.4], [36.3, 33.5]], type: 'LineString' },
      properties: { colorIndex: 9, id: 'route-b', nameAr: 'خط تجريبي' },
      type: 'Feature',
    },
  ],
  type: 'FeatureCollection',
};

beforeEach(() => {
  useMapStore.setState({ hoveredStopId: null, selectedRouteId: null });
});

test('wraps the color index so routes past the palette keep a stable color', async () => {
  const view = await render(<RouteLayer routes={routes} />);

  const color = view.getByTestId('transit-routes').props.paint['line-color'];
  expect(color[1]).toEqual(['%', ['get', 'colorIndex'], routeColors.length]);
  expect(color).toContain(routeColors[7]);
});

test('selects a pressed route and keeps the press from clearing the map', async () => {
  useMapStore.setState({ hoveredStopId: 'stop-1' });
  const view = await render(<RouteLayer interactive routes={routes} />);
  const stopPropagation = jest.fn();

  await fireEvent(view.getByTestId('transit-routes-source'), 'press', {
    nativeEvent: { features: [{ properties: { id: 'route-b' } }] },
    stopPropagation,
  });

  expect(stopPropagation).toHaveBeenCalled();
  expect(useMapStore.getState().selectedRouteId).toBe('route-b');
  expect(useMapStore.getState().hoveredStopId).toBeNull();
});

test('leaves route presses off maps that are not interactive', async () => {
  const view = await render(<RouteLayer routes={routes} />);

  const source = view.getByTestId('transit-routes-source');
  expect(source.props.onPress).toBeUndefined();
  expect(source.props.hitbox).toBeUndefined();
});
