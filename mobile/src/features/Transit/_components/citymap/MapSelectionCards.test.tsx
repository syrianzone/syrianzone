import { fireEvent, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { routeColor } from '../../_lib/mapColors';
import { useMapStore } from '../../_store/useMapStore';
import type { MapDataResponse } from '../../_types';
import { MapSelectionCards } from './MapSelectionCards';

const data: MapDataResponse = {
  routes: {
    features: [
      {
        geometry: { coordinates: [[36.2, 33.4], [36.3, 33.5]], type: 'LineString' },
        properties: { colorIndex: 2, id: 'route-b', nameAr: 'البرامكة إلى المزة' },
        type: 'Feature',
      },
    ],
    type: 'FeatureCollection',
  },
  stops: {
    features: [
      {
        geometry: { coordinates: [36.2, 33.4], type: 'Point' },
        properties: { id: 'stop-7', nameAr: 'الحلبوني', routeIds: ['route-b', 'route-z'] },
        type: 'Feature',
      },
    ],
    type: 'FeatureCollection',
  },
};

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  useMapStore.setState({ hoveredStopId: null, selectedRouteId: null });
});

test('stays out of the way while nothing on the map is selected', async () => {
  const view = await render(<MapSelectionCards data={data} />, { wrapper: Providers });

  expect(view.toJSON()).toBeNull();
});

test('names the selected route on a card in its own color', async () => {
  useMapStore.setState({ selectedRouteId: 'route-b' });

  const view = await render(<MapSelectionCards data={data} />, { wrapper: Providers });

  expect(view.getByText('البرامكة إلى المزة')).toBeTruthy();
  expect(view.getByText('البرامكة إلى المزة').parent).toHaveStyle({
    backgroundColor: routeColor(2),
  });
});

test('badges every route serving the selected stop', async () => {
  useMapStore.setState({ hoveredStopId: 'stop-7' });

  const view = await render(<MapSelectionCards data={data} />, { wrapper: Providers });

  expect(view.getByText('الحلبوني')).toBeTruthy();
  expect(view.getByText('البرامكة إلى المزة')).toBeTruthy();
  expect(view.getByText('مسار route-z')).toBeTruthy();
});

test('closing a card clears the map selection', async () => {
  useMapStore.setState({ hoveredStopId: 'stop-7' });
  const view = await render(<MapSelectionCards data={data} />, { wrapper: Providers });

  await fireEvent.press(view.getByLabelText('إغلاق'));

  expect(useMapStore.getState().hoveredStopId).toBeNull();
});
