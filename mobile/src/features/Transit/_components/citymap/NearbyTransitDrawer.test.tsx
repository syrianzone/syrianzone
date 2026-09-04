import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type { PropsWithChildren } from 'react';

import { LocaleProvider } from '@/contexts/LocaleContext';
import { AppThemeProvider } from '@/contexts/ThemeContext';

import { getNearbyStops } from '../../api';
import { NearbyTransitDrawer } from './NearbyTransitDrawer';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getCurrentPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

jest.mock('../../api', () => ({ getNearbyStops: jest.fn() }));

function Providers({ children }: PropsWithChildren) {
  return (
    <LocaleProvider>
      <AppThemeProvider>{children}</AppThemeProvider>
    </LocaleProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    granted: true,
  } as unknown as Location.LocationPermissionResponse);
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue({
    coords: { latitude: 33.5, longitude: 36.3 },
  } as unknown as Location.LocationObject);
});

test('asks for stops within 500 meters of the user', async () => {
  jest.mocked(getNearbyStops).mockResolvedValue([
    {
      cityId: 'damascus',
      coordinates: [36.3, 33.5],
      id: 'stop-7',
      nameAr: 'الحلبوني',
      routes: [{ id: 'route-b', name_ar: 'البرامكة إلى المزة' }],
    },
  ]);
  const view = await render(<NearbyTransitDrawer />, { wrapper: Providers });

  await fireEvent.press(view.getByText('المحطات القريبة'));

  await waitFor(() => expect(view.getByText('الحلبوني')).toBeTruthy());
  expect(getNearbyStops).toHaveBeenCalledWith(33.5, 36.3, 500);
});

test('says when no stop falls inside the 500 meter radius', async () => {
  jest.mocked(getNearbyStops).mockResolvedValue([]);
  const view = await render(<NearbyTransitDrawer />, { wrapper: Providers });

  await fireEvent.press(view.getByText('المحطات القريبة'));

  await waitFor(() =>
    expect(view.getByText('لا توجد مواقف في نطاق 500 متر')).toBeTruthy(),
  );
});

test('asks for location permission when the user refused it', async () => {
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    granted: false,
  } as unknown as Location.LocationPermissionResponse);
  const view = await render(<NearbyTransitDrawer />, { wrapper: Providers });

  await fireEvent.press(view.getByText('المحطات القريبة'));

  await waitFor(() =>
    expect(
      view.getByText('يرجى السماح بالوصول إلى موقعك من إعدادات التطبيق'),
    ).toBeTruthy(),
  );
  expect(getNearbyStops).not.toHaveBeenCalled();
});

test('reports a failed nearby lookup', async () => {
  jest.mocked(getNearbyStops).mockRejectedValue(new Error('network'));
  const view = await render(<NearbyTransitDrawer />, { wrapper: Providers });

  await fireEvent.press(view.getByText('المحطات القريبة'));

  await waitFor(() =>
    expect(view.getByText('تعذر تحميل المواقف القريبة، حاول مجدداً')).toBeTruthy(),
  );
});
