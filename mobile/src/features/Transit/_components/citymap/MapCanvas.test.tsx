import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { MapCanvas } from './MapCanvas';

const mockCamera = { flyTo: jest.fn() };

jest.mock('@maplibre/maplibre-react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Camera: React.forwardRef(function MockCamera(
      _props: object,
      ref: React.ForwardedRef<object>,
    ) {
      React.useImperativeHandle(ref, () => mockCamera);
      return null;
    }),
    Map: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children),
    ViewAnnotation: ({
      children,
      id,
      onDrag,
      onPress,
    }: {
      children: React.ReactNode;
      id: string;
      onDrag?: (event: unknown) => void;
      onPress?: () => void;
    }) => React.createElement(
      Pressable,
      {
        onPress,
        testID: id,
        ...({ onDrag } as Record<string, unknown>),
      },
      children,
    ),
  };
});

jest.mock('../TransitThemeContext', () => ({
  useTransitTheme: () => ({ theme: 'midnight' }),
}));

jest.mock('./RouteLayer', () => ({ RouteLayer: () => null }));
jest.mock('./StopsLayer', () => ({ StopsLayer: () => null }));
jest.mock('./UserLocationLayer', () => ({ UserLocationLayer: () => null }));

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

beforeEach(() => jest.clearAllMocks());

test('renders draggable route vertices and reports native drag coordinates', async () => {
  const onVertexChange = jest.fn();
  const onVertexPress = jest.fn();
  const view = await render(
    <MapCanvas
      city={city}
      data={data}
      editableVertices={[[36.2, 33.4], [36.3, 33.5]]}
      onVertexChange={onVertexChange}
      onVertexPress={onVertexPress}
      selectedVertexIndex={1}
    />,
  );

  await fireEvent.press(view.getByTestId('transit-edit-vertex-1'));
  await fireEvent(view.getByTestId('transit-edit-vertex-1'), 'drag', {
    nativeEvent: { lngLat: [36.31, 33.51] },
  });

  expect(onVertexPress).toHaveBeenCalledWith(1);
  expect(onVertexChange).toHaveBeenCalledWith(1, [36.31, 33.51]);
  expect(view.getByTestId('transit-edit-vertex-dot-1')).toHaveStyle({
    width: 24,
  });
});

test('does not add annotation views to normal transit maps', async () => {
  const view = await render(<MapCanvas city={city} data={data} />);

  expect(view.queryByTestId('transit-edit-vertex-0')).toBeNull();
});

test('flies the camera to a focused search result', async () => {
  const view = await render(<MapCanvas city={city} data={data} />);

  await view.rerender(
    <MapCanvas city={city} data={data} focus={{ center: [36.3, 33.5], zoom: 15 }} />,
  );

  await waitFor(() =>
    expect(mockCamera.flyTo).toHaveBeenCalledWith({
      center: [36.3, 33.5],
      duration: 800,
      zoom: 15,
    }),
  );
});
