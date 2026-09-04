import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { useMapStore } from '../../_store/useMapStore';
import type { TransitSearchResult } from '../../_types';
import { searchTransit } from '../../api';
import { GlobalSearchBox } from './GlobalSearchBox';

jest.mock('../../api', () => ({ searchTransit: jest.fn() }));

const stopResult: TransitSearchResult = {
  cityId: 'damascus',
  coordinates: [36.3, 33.5],
  id: 'stop-7',
  nameAr: 'الحلبوني',
  type: 'stop',
};

const routeResult: TransitSearchResult = {
  cityId: 'damascus',
  id: 'route-b',
  nameAr: 'البرامكة إلى المزة',
  type: 'route',
};

function Providers({ children }: PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <LocaleProvider>
        <AppThemeProvider>{children}</AppThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  useMapStore.setState({ focus: null, hoveredStopId: null, selectedRouteId: null });
});

test('flies to a picked stop and highlights it on the map', async () => {
  jest.mocked(searchTransit).mockResolvedValue([stopResult]);
  const view = await render(<GlobalSearchBox cityId="damascus" />, {
    wrapper: Providers,
  });

  await fireEvent.changeText(
    view.getByPlaceholderText('ابحث عن خط أو محطة'),
    'الحلبوني',
  );
  await waitFor(() => expect(view.getByText('الحلبوني')).toBeTruthy());
  await fireEvent.press(view.getByText('الحلبوني'));

  expect(useMapStore.getState().hoveredStopId).toBe('stop-7');
  expect(useMapStore.getState().focus).toEqual({
    center: [36.3, 33.5],
    zoom: 15,
  });
});

test('focuses a picked route without moving the camera', async () => {
  jest.mocked(searchTransit).mockResolvedValue([routeResult]);
  const view = await render(<GlobalSearchBox cityId="damascus" />, {
    wrapper: Providers,
  });

  await fireEvent.changeText(
    view.getByPlaceholderText('ابحث عن خط أو محطة'),
    'البرامكة',
  );
  await waitFor(() => expect(view.getByText('البرامكة إلى المزة')).toBeTruthy());
  await fireEvent.press(view.getByText('البرامكة إلى المزة'));

  expect(useMapStore.getState().selectedRouteId).toBe('route-b');
  expect(useMapStore.getState().focus).toBeNull();
});

test('shows a spinner while the search is in flight', async () => {
  jest.mocked(searchTransit).mockReturnValue(new Promise(() => {}));
  const view = await render(<GlobalSearchBox cityId="damascus" />, {
    wrapper: Providers,
  });

  await fireEvent.changeText(
    view.getByPlaceholderText('ابحث عن خط أو محطة'),
    'الحلبوني',
  );

  await waitFor(() =>
    expect(view.getByTestId('transit-search-loading')).toBeTruthy(),
  );
});

test('reports a failed search instead of an empty list', async () => {
  jest.mocked(searchTransit).mockRejectedValue(new Error('network'));
  const view = await render(<GlobalSearchBox cityId="damascus" />, {
    wrapper: Providers,
  });

  await fireEvent.changeText(
    view.getByPlaceholderText('ابحث عن خط أو محطة'),
    'الحلبوني',
  );

  await waitFor(() =>
    expect(view.getByText('تعذر البحث، حاول مجدداً')).toBeTruthy(),
  );
});
