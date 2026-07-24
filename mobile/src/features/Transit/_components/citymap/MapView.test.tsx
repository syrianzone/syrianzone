import { render, waitFor } from '@testing-library/react-native';

import { TransitMapView } from './MapView';

jest.mock('./MapCanvas', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  const { MapContext } = jest.requireActual<typeof import('./MapContext')>(
    './MapContext',
  );
  const map = { setCamera: jest.fn() };

  return {
    MapCanvas: React.forwardRef(function MockMapCanvas(
      _props: object,
      ref: React.ForwardedRef<object>,
    ) {
      React.useImperativeHandle(ref, () => map);
      const contextMap = React.useContext(MapContext);
      return React.createElement(
        Text,
        null,
        (contextMap as unknown) === map
          ? 'map context ready'
          : 'map context missing',
      );
    }),
  };
});

const city = {
  bounds: null,
  center: [36.29, 33.51] as [number, number],
  id: 'damascus',
  nameAr: 'دمشق',
  nameEn: 'Damascus',
  routeCount: 0,
  status: 'active' as const,
  zoom: 11,
};

const data = {
  routes: { features: [], type: 'FeatureCollection' as const },
  stops: { features: [], type: 'FeatureCollection' as const },
};

test('provides the mounted native map instance to map descendants', async () => {
  const view = await render(<TransitMapView city={city} data={data} />);

  await waitFor(() => expect(view.getByText('map context ready')).toBeTruthy());
});
