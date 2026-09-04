import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { useMapStore } from '../../_store/useMapStore';
import { TransitMapView } from './MapView';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock('./MapCanvas', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  const { MapContext } = jest.requireActual<typeof import('./MapContext')>(
    './MapContext',
  );
  const map = { setCamera: jest.fn() };

  return {
    MapCanvas: React.forwardRef(function MockMapCanvas(
      props: {
        onMapPress?: (coordinate: [number, number]) => void;
        showUserLocation?: boolean;
      },
      ref: React.ForwardedRef<object>,
    ) {
      React.useImperativeHandle(ref, () => map);
      const contextMap = React.useContext(MapContext);
      return React.createElement(
        Pressable,
        {
          onPress: () => props.onMapPress?.([36.3, 33.5]),
          testID: 'map-canvas',
        },
        React.createElement(
          Text,
          null,
          (contextMap as unknown) === map
            ? 'map context ready'
            : 'map context missing',
        ),
        React.createElement(
          Text,
          null,
          props.showUserLocation ? 'user location on' : 'user location off',
        ),
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

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useMapStore.setState({ focus: null, hoveredStopId: null, selectedRouteId: null });
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    granted: false,
  } as unknown as Location.LocationPermissionResponse);
});

test('provides the mounted native map instance to map descendants', async () => {
  const view = await render(<TransitMapView city={city} data={data} />, {
    wrapper: Providers,
  });

  await waitFor(() => expect(view.getByText('map context ready')).toBeTruthy());
});

test('clears the selection when the map itself is pressed', async () => {
  useMapStore.setState({ selectedRouteId: 'route-b' });
  const view = await render(
    <TransitMapView city={city} data={data} interactive />,
    { wrapper: Providers },
  );

  await fireEvent.press(view.getByTestId('map-canvas'));

  expect(useMapStore.getState().selectedRouteId).toBeNull();
});

test('keeps editor map presses free of selection clearing', async () => {
  useMapStore.setState({ selectedRouteId: 'route-b' });
  const onMapPress = jest.fn();
  const view = await render(
    <TransitMapView city={city} data={data} onMapPress={onMapPress} />,
    { wrapper: Providers },
  );

  await fireEvent.press(view.getByTestId('map-canvas'));

  expect(onMapPress).toHaveBeenCalledWith([36.3, 33.5]);
  expect(useMapStore.getState().selectedRouteId).toBe('route-b');
});

test('draws the location dot when permission was already granted', async () => {
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    granted: true,
  } as unknown as Location.LocationPermissionResponse);

  const view = await render(
    <TransitMapView city={city} data={data} interactive />,
    { wrapper: Providers },
  );

  await waitFor(() => expect(view.getByText('user location on')).toBeTruthy());
});

test('flies to the user location once permission is granted', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    granted: true,
  } as unknown as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 33.5, longitude: 36.3 },
  } as unknown as Location.LocationObject);
  const view = await render(
    <TransitMapView city={city} data={data} interactive />,
    { wrapper: Providers },
  );

  await fireEvent.press(view.getByLabelText('الانتقال إلى موقعي'));

  await waitFor(() =>
    expect(useMapStore.getState().focus).toEqual({
      center: [36.3, 33.5],
      zoom: 16,
    }),
  );
  expect(view.getByText('user location on')).toBeTruthy();
});

test('explains a refused location permission', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    granted: false,
  } as unknown as Location.LocationPermissionResponse);
  const view = await render(
    <TransitMapView city={city} data={data} interactive />,
    { wrapper: Providers },
  );

  await fireEvent.press(view.getByLabelText('الانتقال إلى موقعي'));

  await waitFor(() =>
    expect(view.getByText('يلزم السماح بالموقع للانتقال إلى مكانك.')).toBeTruthy(),
  );
});

test('leaves the map store clean once the map unmounts', async () => {
  useMapStore.setState({ hoveredStopId: 'stop-7' });
  const view = await render(
    <TransitMapView city={city} data={data} interactive />,
    { wrapper: Providers },
  );

  await view.unmount();

  expect(useMapStore.getState().hoveredStopId).toBeNull();
});
