import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { useMapData } from '../../../_hooks/useMapData';
import TransitCityMapScreen from './Index';

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'aleppo' }),
}));

jest.mock('../../../_hooks/useMapData', () => ({ useMapData: jest.fn() }));
jest.mock('./loading', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return function MockMapLoading() {
    return React.createElement(Text, null, 'map loading');
  };
});
jest.mock('../../../_components/citymap/GlobalSearchBox', () => ({
  GlobalSearchBox: () => null,
}));
jest.mock('../../../_components/citymap/NearbyTransitDrawer', () => ({
  NearbyTransitDrawer: () => null,
}));
jest.mock('../../../_components/citymap/OfflineBanner', () => ({
  OfflineBanner: () => null,
}));
jest.mock('../../../_components/citymap/MapView', () => ({
  TransitMapView: () => null,
}));

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

test('mounts the map loading state when no live or offline data is ready', async () => {
  jest.mocked(useMapData).mockReturnValue({
    data: undefined,
    error: null,
    loading: true,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useMapData>);

  const view = await render(<TransitCityMapScreen />, { wrapper: Providers });

  expect(view.getByText('map loading')).toBeTruthy();
});
