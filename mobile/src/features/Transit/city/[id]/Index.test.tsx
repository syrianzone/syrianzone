import { render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { useRoutes } from '../../_hooks/useMapData';
import TransitCityScreen from './Index';

let mockCityId = 'damascus';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: mockCityId }),
}));

jest.mock('../../_hooks/useMapData', () => ({ useRoutes: jest.fn() }));
jest.mock('./loading', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>(
    'react-native',
  );
  return function MockCityLoading() {
    return React.createElement(Text, null, 'city loading');
  };
});

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  mockCityId = 'damascus';
});

test('mounts the city loading state while route data is pending', async () => {
  jest.mocked(useRoutes).mockReturnValue({
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useRoutes>);

  const view = await render(<TransitCityScreen />, { wrapper: Providers });

  expect(view.getByText('city loading')).toBeTruthy();
});

test('guards a city id that is not in the bundled list', async () => {
  mockCityId = 'atlantis';
  jest.mocked(useRoutes).mockReturnValue({
    data: undefined,
    error: null,
    isError: false,
    isPending: true,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useRoutes>);

  const view = await render(<TransitCityScreen />, { wrapper: Providers });

  expect(view.getByText('المدينة غير موجودة')).toBeTruthy();
  expect(view.queryByText('city loading')).toBeNull();
});

test('subtitles the city with its published route count', async () => {
  jest.mocked(useRoutes).mockReturnValue({
    data: [],
    error: null,
    isError: false,
    isPending: false,
    isRefetching: false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useRoutes>);

  const view = await render(<TransitCityScreen />, { wrapper: Providers });

  expect(view.getByText('دمشق')).toBeTruthy();
  expect(view.getByText('٧ خط سيرفيس')).toBeTruthy();
});
